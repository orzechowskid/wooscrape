/**
 * @param {string} csv
 */
function csvToTable(csv) {
	function cellToTD(contents, isHeader) {
		const el = document.createElement(isHeader ? "th" : "td");

		el.textContent = contents;

		return el;
	}

	function rowToTR(contents, isHeader) {
		const el = document.createElement("tr");

		contents.forEach((v) =>
			el.appendChild(cellToTD(v, isHeader))
		);

		return el;
	}

	const thead = document.querySelector("thead");
	const tbody = document.querySelector("tbody");
	const { data } = Papa.parse(csv);
	const [
		header,
		...rows
	] = data;

	thead.appendChild(rowToTR(header, true));
	rows.forEach((v) =>
		tbody.appendChild(rowToTR(v))
	);
}
async function getDownloadLink(yyyy, mm, dd, data) {
	const btn = document.createElement("a");
	const blob = new Blob([data], { type: "application/csv" });
	btn.setAttribute("download", `${yyyy}-${mm}-${dd}.csv`);
	btn.setAttribute("href", URL.createObjectURL(blob));
	btn.textContent = "click here to download";

	return btn;
}

async function goGetIt(form) {
	const formData = Object.fromEntries(new FormData(form).entries());
	const {
		dd,
		mm,
		yyyy
	} = formData;

	try {
		document.querySelector("#link-container").innerHTML = "";
		document.querySelector("#error-container").innerHTML = "";
		document.querySelector("thead").innerHTML = "";
		document.querySelector("tbody").innerHTML = "";

		const response = await window.fetch(`/api/1/page/${yyyy}/${mm}/${dd}`);

		if (response.status !== 200) {
			throw new Error(String(response.status));
		}

		const result = await response.text();

		csvToTable(result);

		document.querySelector("#link-container").appendChild(await getDownloadLink(yyyy, mm, dd, result));
	}
	catch (ex) {
		document.querySelector("#error-container").textContent = ex.message === "404"
			? "Agenda not found - did you enter the correct date?"
			: `an error occurred: ${ex.message} - ${ex.stack}`;
	}
}

document.querySelector("form").addEventListener("submit", (e) => {
	e.preventDefault();
	goGetIt(e.target);
});
