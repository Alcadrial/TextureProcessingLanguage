

import { readFile } from "node:fs/promises";

console.log("begin")

console.log("Args:")
process.argv.slice(2).forEach((arg) => {
    console.log("\t" + arg);
});

try {
    const programContent = await readFile(process.argv[2]);
    const programString = programContent.toString();
    console.log(programString.split("\n").slice(0, 10).join("\n"));
}
catch (err) {
    console.error(err.message);
}

console.log("end")