
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
/*
type Token = {
    tokenType: string;
}
type Program = {
    tokenType: "program";
    commands: Command[];
}
type Command = (
    ReturnCommand | Decl | Assignment | Call | WhileLike | IfLike | Closure | Function
)
type LoopCommand = Command | {
    tokenType: "break";
} | {
    tokenType: "continue";
}
type ReturnCommand = {
    tokenType: "return";
    expr: Expr;
}
type Decl = ({
    tokenType: "const";
    id: Identifier;
    init: string;
} | {
    tokenType: "var";
    id: Identifier;
    init?: Expr;
})
type Assignment = {
    tokenType: "assignment";
    dstId: Identifier;
    op: string;
    expr: Expr;
}
type Call = {
    tokenType: "call";
    id: Identifier;
    args: Expr[];
}
type WhileLike = {
    tokenType: "while";
    condition: Expr;
    commands: LoopCommand[];
}
type IfLike = {
    tokenType: "if";
    condition: Expr;
    commands: Command[];
    elseCommands?: Command[];
}
type Closure = {
    tokenType: "closure";
    commands: Command[];
}
type Function = {
    tokenType: "function";
    id: Identifier;
    args: Expr[];
    commands: Command[];
}
type Expr = {
    tokenType: "expr";
} & ({
    type: "unary";
    op: string;
    expr: Expr;
} | {
    type: "call";
    functionId: Identifier;
    args: Expr[];
} | {
    type: "binary";
    op: string;
    left: Expr;
    right: Expr;
} | {
    type: "id";
    id: Identifier;
} | {
    type: "value";
    value: string;
} | {
    type: "closure";
    commands: Command[];
})
type Identifier = string
*/

//Tries to parse a "Program" token
function /*Token?*/ buildAst(/*IToken?*/ token) {
    if (!token) return undefined;

    switch (token.type) {
        case "Program": {
            return {
                tokenType: "Program",
                commands: token.children.map(buildAst)/* as Command[] */
            };
        }
        case "LoopCommand": {
            //if there is a children then it's a "Command"
            if (token.children[0]) {
                return buildAst(token.children[0]);
            }
            //otherwise, the token it's "break" or "continue"
            return {
                tokenType: token.text.substring(0, token.text.length - 1).trim()
            };
        }
        case "Command": {
            const commandToken = token.children[0];
            const type = commandToken.type;

            switch (type) {
                case "ReturnCommand": {
                    return {
                        tokenType: "return",
                        expr: buildAstExpr(commandToken.children[0])
                    };
                }
                case "Decl": {
                    const declVariantToken = commandToken.children[0];
                    switch (declVariantToken.type) {
                        case "DeclConst": {
                            return {
                                tokenType: "const",
                                id: buildAst(declVariantToken.children[0])/* as Identifier */,
                                init: buildAst(declVariantToken.children[1])/* as string */
                            };
                        }
                        case "DeclVar": {
                            return {
                                tokenType: "var",
                                id: buildAst(declVariantToken.children[0])/* as Identifier */,
                                init: buildAstExpr(declVariantToken.children[1])/* as Expr */
                            };
                        }
                        default: {
                            return undefined;
                        }
                    }
                }
                case "Assignment": {
                    return {
                        tokenType: "assignment",
                        dstId: buildAst(commandToken.children[0])/* as Identifier */,
                        op: commandToken.children[1].text,
                        expr: buildAstExpr(commandToken.children[2])/* as Expr */
                    };
                }
                case "Call": {
                    return {
                        tokenType: "call",
                        id: buildAst(commandToken.children[0])/* as Identifier */,
                        args: commandToken.children[1].children.map(buildAstExpr)
                    };
                }
                case "WhileLike": {
                    return {
                        tokenType: "while",
                        condition: buildAstExpr(commandToken.children[0]),
                        commands: commandToken.children[1].children.map(buildAst)/* as LoopCommand[] */
                    };
                }
                case "IfLike": {
                    return {
                        tokenType: "if",
                        condition: buildAstExpr(commandToken.children[0]),
                        commands: buildAst(commandToken.children[1])/* as Command[] */,
                        elseCommands: buildAst(commandToken.children[2])/* as Command[] */
                    };
                }
                case "Closure": {
                    return {
                        tokenType: "closure",
                        commands: buildAst(commandToken.children[0])/* as Command[] */
                    };
                }
                case "Function": {
                    return {
                        tokenType: "function",
                        id: buildAst(commandToken.children[0])/* as Identifier */,
                        args: commandToken.children[1].children.map(buildAstExpr),
                        commands: buildAst(commandToken.children[2])/* as Command[] */
                    };
                }
                default: {
                    return undefined;
                }
            }
        }
        case "Expr": {
            return {
                tokenType: "Expr",
                expr: buildAstExpr(token.children[0])
            };
        }
        case "Exec": {
            const execToken = token.children[0];
            if (execToken.type == "Closure") {
                return execToken.children.map(buildAst)/* as Command[] */;
            }
            return [buildAst(execToken)];
        }
        case "Identifier": {
            return token.text.trim();
        }
        case "String": {
            return token.text.trim().substring(1, token.text.length - 1);
        }
        default: {
            return undefined;
        }
    }
}
//Tries to parse an "Expr" token or any component of it, pruning meaningless tokens
function /*Expr?*/ buildAstExpr(/*IToken*/ token) {
    //Forward "Expr" token
    if (token.type == "Expr") return buildAstExpr(token.children[0]);

    //Any binary expression token begins with "Bin"
    if (token.type.substring(0, 3) == "Bin") {
        //Search for a binary expression
        let expr = token;
        let kind = expr.type;
        let e0 = expr.children[0];
        let e1 = expr.children[1];
        while (!e1) {
            expr = e0;
            kind = expr.type;
            //no binary expression found
            if (kind.substring(0, 3) != "Bin") return buildAstExpr(expr);
            e0 = expr.children[0];
            e1 = expr.children[1];
        }
        let op;
        switch (kind.substring(3, kind.length - 4)) {
            case "Concat": op = "|"; break;
            case "Equals": op = "=="; break;
            case "Unequals": op = "!="; break;
            case "GreatherEquals": op = ">="; break;
            case "Greather": op = ">"; break;
            case "LesserEquals": op = "<="; break;
            case "Lesser": op = "<"; break;
            case "And": op = "&&"; break;
            case "Or": op = "||"; break;
            case "Add": op = "+"; break;
            case "Subtract": op = "-"; break;
            case "Multiply": op = "*"; break;
            case "Divide": op = "/"; break;
            case "Remainder": op = "%"; break;
            case "Extract": op = "<@"; break;
            case "Embed": op = ">@"; break;
            case "Ranged": op = "@"; break;
            default: return undefined;
        }
        return {
            tokenType: "expr",
            type: "binary",
            op: op,
            left: buildAstExpr(e0),
            right: buildAstExpr(e1)
        };
    }
    //Not a binary expression
    switch (token.type) {
        case "UnaryExpr": {
            const e = token.children[0];
            if (e.type == "CallExpr") {
                return buildAstExpr(e);
            }
            return {
                tokenType: "expr",
                type: "unary",
                op: e.children[0].text.trim(),
                expr: buildAstExpr(e.children[1])
            };
        }
        case "CallExpr": {
            const e = token.children[0];
            if (e.type == "BracketExpr") {
                return buildAstExpr(e);
            }
            return {
                tokenType: "expr",
                type: "call",
                functionId: buildAstExpr(e.children[0])/* as Identifier */,
                args: e.children.slice(1).map(e0 => buildAstExpr(e0.children[0]))
            };
        }
        case "BracketExpr": {
            return buildAstExpr(token.children[0]);
        }
        case "ClosureExpr": {
            const e = token.children[0];
            if (e.type == "Value") {
                return buildAstExpr(e.children[0])
            }
            return {
                tokenType: "expr",
                type: "closure",
                commands: e.children.map(buildAst)
            };
        }
        case "Identifier": {
            return {
                tokenType: "expr",
                type: "id",
                id: token.text.trim()
            };
        }
        case "String": {
            return {
                tokenType: "expr",
                type: "value",
                value: token.text.trim().substring(1, token.text.length - 1)
            };
        }
        case "Boolean": {
            return {
                tokenType: "expr",
                type: "value",
                value: token.text.trim()
            };
        }
        default: {
            return undefined;
        }
    }
}

const args = process.argv.slice(2);


var syntaxFilename = "syntax.ebnf";
var codeFilename = "test.tpl";
syntaxFilename = "src/simpleSyntax.ebnf";
codeFilename = "examples/simple/test2.tpl";
if (args[0]) codeFilename = "examples/simple/" + args[0] + ".tpl";

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
    const ast = buildAst(parseTree);
    console.log("AST: " + JSON.stringify(ast, null, 4));
}
catch (err) {
    console.error(err.message);
}

