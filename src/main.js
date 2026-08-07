
import { readFile } from "node:fs/promises";
import { Grammars, Parser } from "ebnf";

/*
interface IToken {
    type: string;
    text: string;
    start: number;
    end: number;
    children: IToken[];
    parent: IToken;
    fullText: string;
    errors: TokenError[];
    rest: string;
    fragment?: boolean;
    lookup?: boolean;
}
*/

function buildAst(/*IToken*/ token) {
    console.log("Token: " + token.type);
}


var syntaxFilename = "syntax.ebnf";
var codeFilename = "test.tpl";
syntaxFilename = "src/simpleSyntax.ebnf";
codeFilename = "examples/simple/test2.tpl";

try {
    console.log("Reading syntax...");
    const grammar = await readFile(syntaxFilename, "utf-8");
    const parser = new Parser(Grammars.Custom.getRules(grammar), {});
    console.log("Reading program...");
    const program = await readFile(codeFilename, "utf-8");

    const parseTree = parser.getAST(program);

    if (!parseTree) {
        throw "Failed to parse file";
    }
    buildAst(parseTree);
}
catch (err) {
    console.error(err.message);
}

