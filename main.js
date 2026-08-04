
import { readFile } from "node:fs/promises";
import { Grammars, Parser } from "ebnf";

function printAST(token, level = 0) {
    console.log(
        '         ' + '  '.repeat(level) + `|-${token.type}${token.children.length == 0 ? '=' + token.text : ''}`
    );
    token.children &&
        token.children.forEach(c => {
            printAST(c, level + 1);
        });
}


var syntaxFilename = "expr.syntax.ebnf";
syntaxFilename = "syntax.ebnf";
var codeFilename = "expr.tpl";
codeFilename = "test2.tpl";

try {
    const syntaxContent = await readFile(syntaxFilename);
    const grammar = syntaxContent.toString() + "\r\n";
    const rules = Grammars.Custom.getRules(grammar);

    const parser = new Parser(rules, {});

    console.log("Reading syntax...");

    const ast = parser.getAST((await readFile(codeFilename)).toString());

    if (!ast) {
        console.log("Failed to parse file");
    }
    else {
        printAST(ast);
    }
}
catch (err) {
    console.error(err.message);
}

