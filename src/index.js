import fs from "fs";

import { AsyncParser } from "@json2csv/node";
import { parseHTML } from "linkedom";

const baseUrl = "https://www.worcesterma.gov";
const headers = [
  "Date", "Type", "Subcategory", "Item Number", "Fulltext", "Attachment", "Resolution"
];

function getMeetingDate(document) {
  const dateEl = document.querySelector("table table:first-child tr:nth-child(3) font");

  /* warning: server-local timezone applied */
  return new Date(dateEl.innerHTML);
}

function getAttachmentLink(path) {
  return path
    ? `${baseUrl}${path}`
    : null;
}

/**
 * @description section header tables currently look like this:
 * <table><tbody><tr><td/><td><b><font><p>{name}</p></font></b></td></tr></table>
 * so search for a table with one row which has one <td/> with contents exactly
 * matching the given section name
 * @param {Document} document
 * @param {string} sectionName
 * @returns {HTMLElement|null}
 */
function getDocumentSectionHeader(document, sectionName) {
  return [ ...document.querySelectorAll("table table:not(:has(tr:nth-child(2)))") ].find(
    (table) => {
      if (table.innerHTML.includes(sectionName)) {
	return !![ ...table.querySelectorAll("p") ].find(
	  (p) => p.innerHTML === sectionName
	);
      }
    }
  );
}

function getDocumentSection(document, sectionName, exact = false) {
  const sectionHeader = getDocumentSectionHeader(document, sectionName);

  return exact
    ? sectionHeader
    : sectionHeader?.nextElementSibling;
}

function getPopulatedRows(sectionElement) {
  return [ ...sectionElement.querySelectorAll("tr") ].filter(
    (row) => [ ...row.querySelectorAll("font") ].filter(
      (fontEl) => fontEl.innerHTML.length > 0
    ).length >= 2 /* item number and description */
  );
}

function getPetitionsList(document) {
  const petitionsContainer = getDocumentSection(document, "PETITIONS");

  if (!petitionsContainer) {
    return [];
  }

  return getPopulatedRows(petitionsContainer).map(
    (row) => [
      /* business type */
      "petition",
      /* subcategory */
      "",
      /* item number */
      row.querySelector("td:nth-child(2) b")?.innerHTML?.slice(0, -1),
      /* fulltext */
      row.querySelector("td:nth-child(3) font p")?.innerHTML,
      /* attachment link */
      getAttachmentLink(row.querySelector("td:last-child a")?.getAttribute("href")),
      /* resolution */
      row.nextElementSibling?.querySelector("p b")?.innerHTML
	.replaceAll("\n", " ")
    ]
  );
}

function getHearingAndOrderList(document) {
  const container = getDocumentSection(document, "HEARING AND ORDER");

  if (!container) {
    return [];
  }

  return getPopulatedRows(container).map(
    (row) => [
      /* business type */
      "hearing and order",
      /* subcategory */
      "",
      /* item number */
      row.querySelector("td:nth-child(2) b")?.innerHTML?.slice(0, -1),
      /* fulltext */
      row.querySelector("td:nth-child(3) font p")?.innerHTML,
      /* attachment link */
      getAttachmentLink(row.querySelector("a")?.getAttribute("href")),
      /* resolution */
      row.nextElementSibling?.querySelector("p b")?.innerHTML
	.replaceAll("\n", " ")
    ]
  );
}

function getCommunicationsList(document) {
  const container = getDocumentSection(document, "COMMUNICATIONS OF THE CITY MANAGER", true);
  let list = [];

  if (!container) {
    return list;
  }

  let currentTable = container.nextElementSibling;

  /* until we get to another top-level header... */
  while (currentTable?.querySelectorAll("tr").length !== 1) {
    let subsection, subcategory;

    /* track the current subsection number and subcategory.  skip over any
     * department headers and departments with no items */
    while (currentTable?.querySelectorAll("tr").length === 2) {
      subsection = currentTable.querySelector("p").textContent;
      subcategory = currentTable.querySelector("tr:last-child > td:nth-child(3)").textContent.trim().replaceAll("\n", " - ");
      currentTable = currentTable.nextElementSibling;
    }

    const rows = currentTable.querySelectorAll("tr:has(p)");

    if (rows.length < 2) {
      break;
    }

    const items = [ ...rows ].reduce(
      (acc, _el, idx, arr) => (idx % 2) ? [ ...acc, [arr[idx - 1], arr[idx]]] : acc,
      []
    ).map(([row1, row2]) => [
      /* business type */
      "communication",
      /* subcategory */
      subcategory,
      /* item number */
      `${subsection}.${row1.querySelector("td:nth-child(3)")?.textContent}`.slice(0, -1),
      /* fulltext */
      row1.querySelector("td:nth-child(4)")?.textContent,
      /* attachment link */
      getAttachmentLink(row1.querySelector("a")?.getAttribute("href")),
      /* resolution */
      row2.querySelector("p")?.textContent
        .replaceAll("\n", " ").trim(),
    ]);

    list = [ ...list, ...items ];
    currentTable = currentTable.nextElementSibling;
  }

  return list;
}

async function fetchByDate(year, month, day) {
  // const yyyy = String(year).slice(0, 4).padStart(4, "20");
  // const mm = String(month).slice(0, 2).padStart(2, "0");
  // const dd = String(day).slice(0, 2).padStart(2, "0");

  //	console.log(`fetching: ${yyyy}-${mm}-${dd}`);
  const response = fs.readFileSync("./index.html");
  return response.toString("UTF-8");
  // const response = await fetch(
  // 	`${baseUrl}/agendas-minutes/city-council/${yyyy}/${yyyy}${mm}${dd}.htm`,
  // 	{},
  // );

  // return response.text();
}

async function generateCSV(records) {
  const parser = new AsyncParser({
  });

  return parser.parse(records).promise();
}

async function processDocument(doc) {
  const {
    document
  } = parseHTML(doc);
  const meetingDate = getMeetingDate(document).toISOString().split("T")[0];
  const petitionsList = getPetitionsList(document);
  const hearingAndOrderList = getHearingAndOrderList(document);
  const communicationsList = getCommunicationsList(document);
  const csv = await generateCSV([
    ...petitionsList,
    ...hearingAndOrderList,
    ...communicationsList
  ].map(
    (record) => ({
      "Date": meetingDate,
      ...headers.slice(1).reduce(
	(acc, el, idx) => ({ ...acc, [el]: record[idx] }),
	{}
      )
    })
  ));

  console.log(
    csv
  );
}

async function go() {
  const page = await fetchByDate("2023", "10", 3)

  await processDocument(page);
}

go();
