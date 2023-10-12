import path from "path";

import express from "express";

import { pageToCSV } from "../scraper/index.js";

const app = express();

app.get("/api/1/page/:yyyy/:mm/:dd", async (req, res) => {
	const {
		dd,
		mm,
		yyyy
	} = req.params
	try {
		const csv = await pageToCSV(yyyy, mm, dd);
		res.set("Content-Disposition", `attachment; filename=${yyyy}-${mm}-${dd}.csv`);
		res.status(200);
		res.send(csv);
	}
	catch (ex) {
		console.error(ex);
		res.status(500).end();
	}
});
app.use(express.static(path.resolve(new URL('', import.meta.url).pathname, "..", "public")));

app.listen(3000, () => {
	console.log("listening on :3000");
});
