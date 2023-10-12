// import fs from "fs";

import { AsyncParser } from "@json2csv/node";
import * as CSSSelect from "css-select";
import { DomHandler } from "domhandler";
import * as DomUtils from "domutils";
import { Parser } from "htmlparser2";

const baseUrl = "https://www.worcesterma.gov";

const _enhance = (el) => {
  if (el.__enhanced) {
    return el;
  }

  el.__enhanced = true;
  el.querySelector = function(selector) {
    const res = CSSSelect.selectOne(selector, el);

    if (res) {
      _enhance(res);
    }

    return res;
  }; // bind?
  el.querySelectorAll = function(selector) {
    const res = CSSSelect.selectAll(selector, el);
    const rc = res.map(_enhance);

    Object.defineProperty(rc, "item", {
      get() {
        return (idx) => rc[idx];
      }
    });

    return rc;
  };
  el.closest = function(selector) { // FIXME: horrible
    let p = _enhance(DomUtils.getParent(el));

    while (p && p.tagName !== selector) {
      p = _enhance(DomUtils.getParent(p));
    }

    return p;
  };
  el.getAttribute = function(attr) {
    return DomUtils.getAttributeValue(el, attr);
  };
  Object.defineProperties(el, {
    "innerHTML": {
      get() {
        return DomUtils.getInnerHTML(this);
      }
    },
    "nextElementSibling": {
      get() {
        return _enhance(DomUtils.nextElementSibling(this));
      }
    },
    "outerHTML": {
      get() {
        return DomUtils.getOuterHTML(this);
      }
    },
    "parentElement": {
      get() {
        return _enhance(DomUtils.getParent(this));
      }
    },
    "previousElementSibling": {
      get() {
        return _enhance(DomUtils.prevElementSibling(this));
      }
    },
    "tagName": {
      get() {
        return this.name;
      }
    },
    "textContent": {
      get() {
        return DomUtils.textContent(this);
      }
    }
  });

  return el;
};

function getMeetingDate(document) {
  const dateEl = document.querySelector("table table:first-child tr:nth-child(3)");
  /* warning: server-local timezone applied */
  return new Date(dateEl.textContent);
}

function getAttachmentLink(path) {
  return path
    ? `${baseUrl}${path}`
    : null;
}


async function fetchByDate(year, month, day) {
  const yyyy = String(year).slice(0, 4).padStart(4, "20");
  const mm = String(month).slice(0, 2).padStart(2, "0");
  const dd = String(day).slice(0, 2).padStart(2, "0");

  console.log(`fetching: ${yyyy}-${mm}-${dd}`);
  const response = await fetch(
        `${baseUrl}/agendas-minutes/city-council/${yyyy}/${yyyy}${mm}${dd}.htm`,
        {},
  );

  return response.text();
  // const response = fs.readFileSync("./index.html");
  // return response.toString("UTF-8");
}

function generateCSV(records) {
  const parser = new AsyncParser({ });

  return parser.parse(records).promise();
}

async function processDocument(doc) {
  return new Promise((resolve, reject) => {
    const handler = new DomHandler((error, dom) => {
      if (error) {
        reject(error);
      }
      else {
        resolve(_enhance(dom));
      }
    });
    const parser = new Parser(handler);

    parser.write(doc);
    parser.end();
  });
}

function scanDocument(document) {
  const meetingDate = getMeetingDate(document).toISOString().split("T")[0];
  const csvContents = [ ...document.querySelectorAll("table table tr:has(a)") ]
    .slice(2) // page header goo
    .map(
      (row) => {
        const headingDepth = [ ...row.querySelectorAll("td") ].findIndex((td) => !!td.textContent?.length);
        const categories = [
          row.querySelectorAll("td").item(headingDepth).textContent
        ];

        for (let i = headingDepth - 1; i >= 0; i--) {
          let tableEl = row.closest("table").previousElementSibling;

          while (tableEl && !(tableEl.querySelector(`tr:last-child td:nth-child(${i+1})`)?.textContent?.length)) {
            tableEl = tableEl.previousElementSibling;
          }

          if (!tableEl) {
            break;
          }

          categories.unshift([ ...tableEl.querySelectorAll(`tr:last-child > td`) ]
            .map((td) => td.textContent.trim().replaceAll("\n", " "))
            .filter(Boolean)
            .join(" - ")
          )
        }

        /* turn this row's data into an object with known keys */
        return {
          "date": meetingDate,
          category1: categories[0],
          category2: categories[1],
          category3: categories[2],
          fulltext: row.querySelector("p")?.textContent,
          attachmentLink: getAttachmentLink(row.querySelector("a")?.getAttribute("href")),
          resolution: row.nextElementSibling.querySelector("p")?.textContent.replaceAll("\n", " ").trim()
        };
      }
    );

  return csvContents;
}

async function go() {
  const page = await fetchByDate("2023", 10, "10");
  const document = await processDocument(page);
  const result = scanDocument(document);
  const csv = await generateCSV(result);

  console.log(result);
  console.log(csv);
}

go();
