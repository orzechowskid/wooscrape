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

	document.querySelector("pre").textContent = "";

	const response = await window.fetch(`/api/1/page/${yyyy}/${mm}/${dd}`);
	const result = await response.text();

	document.querySelector("pre").textContent = result;
	document.querySelector("#link-container").appendChild(await getDownloadLink(yyyy, mm, dd, result));
}

document.querySelector("form")
	.addEventListener(
		"submit",
		(e) => {
			e.preventDefault();
			goGetIt(e.target);
		}
	);
