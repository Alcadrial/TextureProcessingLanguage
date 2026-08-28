
import { readFile } from "node:fs/promises";
import { Grammars, Parser } from "ebnf";
import sharp from "sharp"

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
type DebugData = {
    lineNumber: number;
    text: string;
}
type Token = {
    tokenType: string;
    debugData: DebugData;
}
type Program = {
    tokenType: "program";
    debugData: DebugData;
    commands: Command[];
}
type Command = (
    Signal | ReturnCommand | Decl | Assignment | Call | WhileLike | IfLike | Closure | Function
)
type Signal = {
    tokenType: "signal"
    debugData: DebugData;
    message?: string;
}
type Print = {
    tokenType: "print"
    debugData: DebugData;
    message: string;
    args: Expr[];
}
type LoopCommand = Command | {
    tokenType: "break";
    debugData: DebugData;
} | {
    tokenType: "continue";
    debugData: DebugData;
}
type ReturnCommand = {
    tokenType: "return";
    debugData: DebugData;
    expr: Expr;
}
type Decl = ({
    tokenType: "const";
    debugData: DebugData;
    id: Identifier;
    init: string;
} | {
    tokenType: "var";
    debugData: DebugData;
    id: Identifier;
    init?: Expr;
})
type Assignment = {
    tokenType: "assignment";
    debugData: DebugData;
    dstId: Identifier;
    init?: Expr;
}
type Call = {
    tokenType: "call";
    debugData: DebugData;
    id: Identifier;
    args: Expr[];
}
type WhileLike = {
    tokenType: "while";
    debugData: DebugData;
    condition: Expr;
    commands: LoopCommand[];
}
type IfLike = {
    tokenType: "if";
    debugData: DebugData;
    condition: Expr;
    commands: Command[];
    elseCommands?: Command[];
}
type Closure = {
    tokenType: "closure";
    debugData: DebugData;
    commands: Command[];
}
type Function = {
    tokenType: "function";
    debugData: DebugData;
    id: Identifier;
    args: Identifier[];
    commands: Command[];
}
type Expr = {
    tokenType: "expr";
    debugData: DebugData;
} & ({
    type: "operation";
    op: string;
    exprs: Expr[];
} | {
    type: "call";
    functionId: Identifier;
    args: Expr[];
} | {
    type: "id";
    id: Identifier;
} | {
    type: "boolean" | "string" | "number";
    value: string;
} | {
    type: "closure";
    commands: Command[];
})
type Identifier = string
*/

function buildAst(token, allowFullExpr = false) {
    return new AstBuilder(token).buildAst(token, allowFullExpr);
}

class AstBuilder {

    constructor(token) {
        this.text = token.text;
        this.lineCounter = [];
        let i = 0;
        for (const c of this.text) {
            if (c == '\n') this.lineCounter.push(i);
            i++;
        }
    }

    getLocation(token) {
        for (let i = 0; i < this.lineCounter.length; i++) {
            if (this.lineCounter[i] >= token.start) {
                return {
                    lineNumber: i + 1
                };
            }
        }

        return {
            lineNumber: this.lineCounter.length + 1
        };
    }

    getDebugData(token) {
        let text = token.text.trim();
        return {
            location: this.getLocation(token),
            text: text.length < 30 ? text : text.substring(0, 27) + "..."
        };
    }

    buildAst(token, allowFullExpr = false) {
        if (!token) return undefined;

        switch (token.type) {
            case "Program": {
                if (token.children[0]?.type == "Expr") {
                    if (!allowFullExpr) {
                        console.log("Expr not allowed");
                        return undefined;
                    }
                    return this.buildAstExpr(token.children[0]);
                }
                return {
                    tokenType: "program",
                    commands: token.children.map(t => this.buildAst(t))/* as Command[] */,
                    debugData: this.getDebugData(token)
                };
            }
            case "LoopCommand": {
                //if there is a children then it's a "Command"
                if (token.children[0]) {
                    return this.buildAst(token.children[0]);
                }
                //otherwise, the token it's "break" or "continue"
                return {
                    tokenType: token.text.substring(0, token.text.length - 1).trim(),
                    debugData: this.getDebugData(token)
                };
            }
            case "Command": {
                const commandToken = token.children[0];
                const type = commandToken.type;

                switch (type) {
                    case "Nop": {
                        return undefined;
                    }
                    case "Signal": {
                        return {
                            tokenType: "signal",
                            debugData: this.getDebugData(commandToken),
                            message: this.buildAst(commandToken.children[0])/* as String */
                        };
                    }
                    case "Print": {
                        return {
                            tokenType: "print",
                            debugData: this.getDebugData(commandToken),
                            message: this.buildAst(commandToken.children[0])/* as String */,
                            args: commandToken.children[1].children.map(t => this.buildAstExpr(t))
                        };
                    }
                    case "ReturnCommand": {
                        return {
                            tokenType: "return",
                            debugData: this.getDebugData(commandToken),
                            expr: this.buildAstExpr(commandToken.children[0])
                        };
                    }
                    case "Decl": {
                        const declVariantToken = commandToken.children[0];
                        switch (declVariantToken.type) {
                            case "DeclConst": {
                                return {
                                    tokenType: "const",
                                    debugData: this.getDebugData(declVariantToken),
                                    id: this.buildAst(declVariantToken.children[0])/* as Identifier */,
                                    init: this.buildAst(declVariantToken.children[1])/* as string */
                                };
                            }
                            case "DeclVar": {
                                return {
                                    tokenType: "var",
                                    debugData: this.getDebugData(declVariantToken),
                                    id: this.buildAst(declVariantToken.children[0])/* as Identifier */,
                                    init: declVariantToken.children[1] ? this.buildAstExpr(declVariantToken.children[1]) : null/* as Expr */
                                };
                            }
                            default: {
                                return undefined;
                            }
                        }
                    }
                    case "Assignment": {
                        const debugData = this.getDebugData(commandToken);
                        const dstId = this.buildAst(commandToken.children[0])/* as Identifier */;
                        const assignOp = commandToken.children[1];
                        const expr = this.buildAstExpr(commandToken.children[2])/* as Expr */;
                        return {
                            tokenType: "assignment",
                            debugData,
                            dstId,
                            op: assignOp.text,
                            init: assignOp.children[0] ? {
                                tokenType: "expr",
                                debugData,
                                type: "operation",
                                op: assignOp.children[0].text,
                                exprs: [{
                                    tokenType: "expr",
                                    debugData,
                                    type: "id",
                                    id: dstId
                                }, expr],
                            } : expr
                        };
                    }
                    case "Call": {
                        return {
                            tokenType: "call",
                            debugData: this.getDebugData(commandToken),
                            id: this.buildAst(commandToken.children[0])/* as Identifier */,
                            args: commandToken.children[1].children.map(t => this.buildAstExpr(t))
                        };
                    }
                    case "WhileLike": {
                        return {
                            tokenType: "while",
                            debugData: this.getDebugData(commandToken),
                            condition: this.buildAstExpr(commandToken.children[0]),
                            commands: commandToken.children[1].children.map(t => this.buildAst(t)).filter(c => c)/* as LoopCommand[] */
                        };
                    }
                    case "IfLike": {
                        return {
                            tokenType: "if",
                            debugData: this.getDebugData(commandToken),
                            condition: this.buildAstExpr(commandToken.children[0]),
                            commands: this.buildAst(commandToken.children[1]).filter(c => c)/* as Command[] */,
                            elseCommands: this.buildAst(commandToken.children[2])?.filter(c => c)/* as Command[] */
                        };
                    }
                    case "Closure": {
                        return {
                            tokenType: "closure",
                            debugData: this.getDebugData(commandToken),
                            commands: commandToken.children.map(t => this.buildAst(t)).filter(c => c)/* as Command[] */
                        };
                    }
                    case "Function": {
                        return {
                            tokenType: "function",
                            debugData: this.getDebugData(commandToken),
                            id: this.buildAst(commandToken.children[0])/* as Identifier */,
                            args: commandToken.children[1].children.map(t => this.buildAst(t))/* as Identifier[] */,
                            commands: this.buildAst(commandToken.children[2]).filter(c => c)/* as Command[] */
                        };
                    }
                    default: {
                        return undefined;
                    }
                }
            }
            case "Expr": {
                return {
                    tokenType: "expr",
                    debugData: this.getDebugData(token),
                    expr: this.buildAstExpr(token.children[0])
                };
            }
            case "Exec": {
                const execToken = token.children[0];
                if (execToken.type == "Closure") {
                    return execToken.children.map(t => this.buildAst(t)).filter(c => c)/* as Command[] */;
                }
                return [this.buildAst(execToken)];
            }
            case "Identifier": {
                return token.text.trim();
            }
            case "String": {
                return token.text.trim().substring(1, token.text.length - 1);
            }
            default: {
                console.log("Unknown token " + token.type)
                return undefined;
            }
        }
    }
    //Tries to parse a "Program" token
    //Tries to parse an "Expr" token or any component of it, pruning meaningless tokens
    buildAstExpr(token) {
        if (token.type == "Expr") return this.buildAstExpr(token.children[0]);

        if (token.type.substring(0, 3) == "Bin") {
            //Search for a binary expression
            let expr = token;
            let kind = expr.type;
            let e0 = expr.children[0];
            let e2 = expr.children[2];
            while (!e2) {
                expr = e0;
                kind = expr.type;
                if (kind.substring(0, 3) != "Bin") return this.buildAstExpr(expr);
                e0 = expr.children[0];
                e2 = expr.children[2];
            }
            return {
                tokenType: "expr",
                debugData: this.getDebugData(expr),
                type: "operation",
                op: expr.children[1].text,
                exprs: [this.buildAstExpr(e0), this.buildAstExpr(e2)]
            };
        }
        //Search for an unary expression
        switch (token.type) {
            case "UnaryExpr": {
                const e = token.children[0];
                if (e.type == "CallExpr") {
                    return this.buildAstExpr(e);
                }
                return {
                    tokenType: "expr",
                    debugData: this.getDebugData(token),
                    type: "operation",
                    op: e.text.trim(),
                    exprs: [this.buildAstExpr(token.children[1])]
                };
            }
            case "CallExpr": {
                const e = token.children[0];
                if (e.type == "BracketExpr") {
                    return this.buildAstExpr(e);
                }
                return {
                    tokenType: "expr",
                    debugData: this.getDebugData(token),
                    type: "call",
                    functionId: this.buildAst(token.children[0])/* as Identifier */,
                    args: token.children[1].children.map(e0 => this.buildAstExpr(e0))
                };
            }
            case "BracketExpr": {
                return this.buildAstExpr(token.children[0]);
            }
            case "ClosureExpr": {
                const e = token.children[0];
                if (e.type == "Value") {
                    return this.buildAstExpr(e.children[0])
                }
                return {
                    tokenType: "expr",
                    debugData: this.getDebugData(token),
                    type: "closure",
                    commands: e.children.map(t => this.buildAst(t)).filter(c => c)
                };
            }
            case "Identifier": {
                return {
                    tokenType: "expr",
                    debugData: this.getDebugData(token),
                    type: "id",
                    id: token.text.trim()
                };
            }
            case "String": {
                return {
                    tokenType: "expr",
                    debugData: this.getDebugData(token),
                    type: "string",
                    value: token.text.trim().substring(1, token.text.length - 1)
                };
            }
            case "Boolean": {
                return {
                    tokenType: "expr",
                    debugData: this.getDebugData(token),
                    type: "boolean",
                    value: token.text.trim()
                };
            }
            case "Float": {
                return {
                    tokenType: "expr",
                    debugData: this.getDebugData(token),
                    type: "number",
                    value: token.text.trim()
                };
            }
            case "Int": {
                return {
                    tokenType: "expr",
                    debugData: this.getDebugData(token),
                    type: "number",
                    value: token.text.trim()
                };
            }
            default: {
                return undefined;
            }
        }
    }
}

const Types = {
    IMAGE: 0,
    STRING: 1,
    BOOLEAN: 2,
    NUMBER: 3
}

function getTypeName(type) {
    return ["image", "string", "boolean", "number"][type] ?? "unknown";
}

const ScopeTypes = {
    GLOBAL: 0,
    LOOP: 1,
    PLAIN: 2,
    CLOSURE: 3
}

function getScopeTypeName(type) {
    return ["global", "loop", "plain"][type] ?? "unknown";
}

function getVarString(variable) {

    switch (variable.type) {
        case Types.BOOLEAN:
        case Types.NUMBER:
        case Types.STRING:
            return variable.value;
        case Types.IMAGE:
            const info = variable.value.info;
            return `{Image ${info.width}x${info.height}}`;
        default:
            return "{unknown object}";
    }
}

class Context {

    constructor() {
        this.scope = {
            type: ScopeTypes.GLOBAL,
            name: "global",
            isRunning: true,
            environment: new Environment(),
            higherScope: null,
            token: undefined,
            state: new State()
        };
    }

    newScope(type, name) {
        return {
            type: type,
            name: name,
            isRunning: true,
            environment: new Environment(this.scope.environment),
            higherScope: this.scope,
            token: undefined,
            state: new State(this.scope.state)
        };
    }

    pushScope(typeOrScope, name) {
        this.scope = typeof typeOrScope == "object" ? typeOrScope : this.newScope(typeOrScope, name);
    }

    popScope() {
        this.scope = this.scope.higherScope;
    }

    throw(error) {
        const debugData = this.scope.token?.debugData;
        const lineNumber = debugData?.location?.lineNumber ?? -1;

        throw `Error: ${error}\n${this.collectStackTrace()}`;
    }

    signal(message) {
        if (message === undefined) message = "Current execution trace";
        message += ": \n" + this.collectStackTrace();
        console.log(message);
    }

    collectStackTrace() {
        let message = "";
        let lineNumber = undefined;
        for (let scope = this.scope; scope; scope = scope.higherScope) {
            const debugData = scope.token?.debugData;
            if (lineNumber === undefined) {
                lineNumber = debugData?.location?.lineNumber ?? -1;
            }
            if (scope.name) {
                message += `    at ${scope.name}(line:${lineNumber != -1 ? lineNumber : "?"})\n`;
                lineNumber = undefined;
            }
        }
        return message;
    }
}

class Environment {

    constructor(environment) {
        if (environment) {
            //copy all denotable values
            this.operations = { ...environment.operations };
            this.functions = { ...environment.functions };
        }
        else {
            this.operations = {};
            this.functions = {};
        }
    }

    bindOperation(name, inputTypes, outputType, op) {
        this.operations[`${name} ${inputTypes}`] = {
            operation: op,
            outputType
        };
    }

    lookupOperation(name, inputTypes) {
        return this.operations[`${name} ${inputTypes}`];
    }

    bindFunctions(name, f) {
        this.functions[name] = f;
    }

    lookupFunction(name) {
        return this.functions[name];
    }
}

class State {

    constructor(state) {
        if (state) {
            //copy of all variables
            this.variables = { ...state.variables };
        }
        else {
            this.variables = {};
        }
    }

    addVariable(name, value, type, isConst, context) {
        if (this.variables[name]) context.throw("Duplicate declaration of " + name);
        if (isConst) {
            if (type !== Types.STRING) context.throw("Const declaration is supported only for strings");
            this.variables[name] = {
                name,
                value,
                type,
                isConst: true
            };
            return;
        }
        if (type == null) {
            this.variables[name] = { name, value, type, isConst };
            return;
        }
        if (this.isAssignableTo(type, null)) {
            this.variables[name] = { name, value, type, isConst };
        }
        else {
            context.throw(`Cannot create a variable of type ${getTypeName(type)}`);
        }
    }

    setVariable(name, value, type, context) {
        const varr = this.variables[name];
        if (!varr) context.throw(`Missing declaration of ${name}`);
        if (!this.isAssignableTo(type, varr.type)) context.throw(`Incompatible assignment of type ${type} into a variable of type ${varr.type}`);
        varr.value = value;
        varr.type = type;
    }

    isAssignableTo(valueType, varType) {
        if (varType == null) {
            return true;
        }
        if (valueType == varType) return true;
        if (varType == Types.STRING && valueType == Types.IMAGE) return true;
        return false;
    }

    replaceVariable(name, value, type, isConst) {
        this.variables[name] = {
            name,
            value,
            type,
            isConst
        };
    }

    getVariable(name, context) {
        const varr = this.variables[name];
        if (!varr) context.throw(`Variable ${name} not declared`);
        return varr;
    }
}

class Engine {

    constructor(options/*: {
        path,
        debug
    }*/) {
        this.context = new Context();
        (e => {
            e.bindOperation("!", [Types.BOOLEAN], Types.BOOLEAN, (v) => !v);
            e.bindOperation("-", [Types.NUMBER], Types.NUMBER, (v) => -v);
            e.bindOperation("|", [Types.IMAGE], Types.IMAGE, async (v) => await this.applyFlop(v));
            e.bindOperation("#", [Types.IMAGE], Types.IMAGE, async (v) => await this.applySharpen(v));

            e.bindOperation("==", [Types.NUMBER, Types.NUMBER], Types.BOOLEAN, (v, w) => v == w);
            e.bindOperation("==", [Types.BOOLEAN, Types.BOOLEAN], Types.BOOLEAN, (v, w) => v == w);
            e.bindOperation("!=", [Types.NUMBER, Types.NUMBER], Types.BOOLEAN, (v, w) => v != w);
            e.bindOperation("!=", [Types.BOOLEAN, Types.BOOLEAN], Types.BOOLEAN, (v, w) => v != w);
            e.bindOperation(">=", [Types.NUMBER, Types.NUMBER], Types.BOOLEAN, (v, w) => v >= w);
            e.bindOperation(">", [Types.NUMBER, Types.NUMBER], Types.BOOLEAN, (v, w) => v > w);
            e.bindOperation("<=", [Types.NUMBER, Types.NUMBER], Types.BOOLEAN, (v, w) => v <= w);
            e.bindOperation("<", [Types.NUMBER, Types.NUMBER], Types.BOOLEAN, (v, w) => v < w);
            e.bindOperation("&&", [Types.BOOLEAN, Types.BOOLEAN], Types.BOOLEAN, (v, w) => v && w);
            e.bindOperation("||", [Types.BOOLEAN, Types.BOOLEAN], Types.BOOLEAN, (v, w) => v || w);
            e.bindOperation("+", [Types.NUMBER, Types.NUMBER], Types.NUMBER, (v, w) => v + w);
            e.bindOperation("-", [Types.NUMBER, Types.NUMBER], Types.NUMBER, (v, w) => v - w);
            e.bindOperation("*", [Types.NUMBER, Types.NUMBER], Types.NUMBER, (v, w) => v * w);
            e.bindOperation("/", [Types.NUMBER, Types.NUMBER], Types.NUMBER, (v, w) => v / w);
            e.bindOperation("%", [Types.NUMBER, Types.NUMBER], Types.NUMBER, (v, w) => v % w);

            e.bindOperation("+", [Types.IMAGE, Types.IMAGE], Types.IMAGE, async (v, w) => await this.applyElementWiseOperation((c0, c1) => c0 + c1, [v, w]));
            e.bindOperation("-", [Types.IMAGE, Types.IMAGE], Types.IMAGE, async (v, w) => await this.applyElementWiseOperation((c0, c1) => c0 - c1, [v, w]));
            e.bindOperation("*", [Types.IMAGE, Types.IMAGE], Types.IMAGE, async (v, w) => await this.applyElementWiseOperation((c0, c1) => c0 * c1, [v, w]));
            e.bindOperation("/", [Types.IMAGE, Types.IMAGE], Types.IMAGE, async (v, w) => await this.applyElementWiseOperation((c0, c1) => c0 / c1, [v, w]));
            e.bindOperation("%", [Types.IMAGE, Types.IMAGE], Types.IMAGE, async (v, w) => await this.applyElementWiseOperation((c0, c1) => c0 % c1, [v, w]));
            e.bindOperation("**", [Types.IMAGE, Types.IMAGE], Types.IMAGE, async (v, w) => await this.applyBlending(v, w));

            e.bindOperation("@", [Types.IMAGE, Types.NUMBER], Types.IMAGE, async (v, i) => await this.applyRotation(v, i));
            e.bindOperation("!@", [Types.IMAGE, Types.NUMBER], Types.IMAGE, async (v, i) => await this.applyRotation(v, -i));

            e.bindOperation("|<", [Types.IMAGE, Types.IMAGE], Types.IMAGE, async (v, w) => await this.applyConcat(v, w, -1, 0));
            e.bindOperation("|>", [Types.IMAGE, Types.IMAGE], Types.IMAGE, async (v, w) => await this.applyConcat(v, w, 1, 0));
            e.bindOperation("|v", [Types.IMAGE, Types.IMAGE], Types.IMAGE, async (v, w) => await this.applyConcat(v, w, 0, 1));
            e.bindOperation("|^", [Types.IMAGE, Types.IMAGE], Types.IMAGE, async (v, w) => await this.applyConcat(v, w, 0, -1));
            e.bindOperation("|<^", [Types.IMAGE, Types.IMAGE], Types.IMAGE, async (v, w) => await this.applyConcat(v, w, -1, -1));
            e.bindOperation("|<v", [Types.IMAGE, Types.IMAGE], Types.IMAGE, async (v, w) => await this.applyConcat(v, w, -1, 1));
            e.bindOperation("|>v", [Types.IMAGE, Types.IMAGE], Types.IMAGE, async (v, w) => await this.applyConcat(v, w, 1, 1));
            e.bindOperation("|>^", [Types.IMAGE, Types.IMAGE], Types.IMAGE, async (v, w) => await this.applyConcat(v, w, 1, -1));

        })(this.context.scope.environment);

        this.options = { ...options };
        if (!this.options.path.endsWith("/")) this.options.path += "/";
    }

    async execute(token) {
        if (!token) this.context.throw("Cannot execute an undefined token");
        if (this.options.debug) console.log("Command: " + token.tokenType);

        this.context.scope.token = token;
        switch (token.tokenType) {
            case "program": {
                let result;
                for (const command of token.commands) {
                    result = await this.execute(command);
                    if (!this.context.scope.isRunning) break;
                }
                return result;
            }
            case "signal": {
                this.context.signal(token.message);
                break;
            }
            case "print": {
                let m = token.message;
                if (m.includes("%s")) {
                    for (const arg of token.args) {
                        const v = await this.execute(arg);
                        m = m.replace("%s", getVarString(v));
                        if (!m.includes("%s")) break;
                    }
                }
                console.log(m);
                break;
            }
            case "return": {
                this.context.scope.return = true;
                this.context.scope.isRunning = false;
                for (let s = this.context.scope; s.type != ScopeTypes.CLOSURE && s.type != ScopeTypes.GLOBAL; s = s.higherScope) {
                    s.higherScope.return = true;
                    s.higherScope.isRunning = false;
                }
                const result = await this.execute(token.expr);
                if (this.context.scope.type == ScopeTypes.GLOBAL) {
                    if (result.type == Types.STRING) {
                        result.value = await this.loadImage(result.value);
                        result.type = Types.IMAGE;
                    }
                }
                return result;
            }
            case "const": {
                this.context.scope.state.addVariable(token.id, token.init, Types.STRING, true, this.context);
                break;
            }
            case "var": {
                if (token.init) {
                    const result = await this.execute(token.init);
                    if (result == null) this.context.throw(`Assignment expression must return a value`);
                    this.context.scope.state.addVariable(token.id, result.value, result.type, false, this.context);
                }
                else {
                    this.context.scope.state.addVariable(token.id, null, null, false, this.context);
                }
                break;
            }
            case "assignment": {
                const result = await this.execute(token.init);
                if (result == null) this.context.throw(`Assignment expression must return a value`);

                this.context.scope.state.setVariable(token.dstId, result.value, result.type, this.context);
                break;
            }
            case "call": {
                const args = [];
                const types = [];
                for (const expr of token.args) {
                    const result = await this.execute(expr);
                    if (result === null) this.context.throw(`Expression does not return a value`);
                    args.push(result.value);
                    types.push(result.type);
                }
                const f = this.context.scope.environment.lookupFunction(token.id);
                if (f === undefined) this.context.throw(`Function ${token.id} not found`);

                return await this.executeCommands(ScopeTypes.CLOSURE, f.commands, token.id, async state => {
                    for (const i in f.args) {
                        state.replaceVariable(f.args[i], args[i], types[i], false);
                    }
                });
            }
            case "while": {
                let condition = await this.execute(token.condition);
                if (condition.type != Types.BOOLEAN) this.context.throw(`Value of type ${getTypeName(condition.type)} cannot be casted to boolean`);
                while (condition.value) {
                    let result = await this.executeCommands(ScopeTypes.LOOP, token.commands);
                    if (this.context.scope.return) return result;
                    if (this.context.scope.break) break;
                    condition = await this.execute(token.condition);
                    if (condition.type != Types.BOOLEAN) this.context.throw(`Value of type ${getTypeName(condition.type)} cannot be casted to boolean`);
                }
                this.context.scope.break = undefined;
                break;
            }
            case "continue": {
                if (!this.context.scope.type != ScopeTypes.LOOP) this.context.throw("Cannot continue outside a loop");
                this.context.scope.isRunning = false;
                break;
            }
            case "break": {
                if (!this.context.scope.type != ScopeTypes.LOOP) this.context.throw("Cannot break outside a loop");
                this.context.scope.isRunning = false;
                this.context.scope.higherScope.break = true;
                break;
            }
            case "if": {
                let result = await this.execute(token.condition);
                if (result.type != Types.BOOLEAN) this.context.throw(`Value of type ${getTypeName(result.type)} cannot be casted to boolean`);
                if (result.value) {
                    result = await this.executeCommands(ScopeTypes.PLAIN, token.commands);
                }
                else if (token.elseCommands) {
                    result = await this.executeCommands(ScopeTypes.PLAIN, token.elseCommands);
                }
                return result;
            }
            case "closure": {
                return await this.executeCommands(ScopeTypes.CLOSURE, token.commands, "closure");
            }
            case "function": {
                this.context.scope.environment.bindFunctions(token.id, {
                    args: token.args,
                    commands: token.commands
                });
                break;
            }
            case "expr": {
                switch (token.type) {
                    case "boolean": {
                        return {
                            value: token.value ? true : false,
                            type: Types.BOOLEAN
                        };
                    }
                    case "string": {
                        return {
                            value: token.value,
                            type: Types.STRING
                        };
                    }
                    case "number": {
                        return {
                            value: Number(token.value),
                            type: Types.NUMBER
                        };
                    }
                    case "id": {
                        return { ...this.context.scope.state.getVariable(token.id, this.context) };
                    }
                    case "call": {
                        const args = [];
                        const types = [];
                        for (const expr of token.args) {
                            const result = await this.execute(expr);
                            if (result === null) this.context.throw(`Expression does not return a value`);
                            args.push(result.value);
                            types.push(result.type);
                        }
                        const f = this.context.scope.environment.lookupFunction(token.functionId);
                        if (f === undefined) this.context.throw(`Function ${token.functionId} not found`);

                        const result = await this.executeCommands(ScopeTypes.CLOSURE, f.commands, token.functionId, async state => {
                            for (const i in f.args) {
                                state.replaceVariable(f.args[i], args[i], types[i], false);
                            }
                        });
                        if (result === null) this.context.throw(`Missing return statement after executing function ${token.functionId}`);
                        return result;
                    }
                    case "closure": {
                        return await this.executeCommands(ScopeTypes.CLOSURE, token.commands, "closure");
                    }
                    case "operation": {
                        const args = [];
                        const types = [];
                        for (const expr of token.exprs) {
                            const result = await this.execute(expr);
                            if (result === null) this.context.throw(`Expression does not return a value`);
                            if (result.type === null) this.context.throw(`Cannot coerce expression "${expr.debugData.text}" to a value`);
                            args.push(result.value);
                            types.push(result.type);
                        }
                        var o = this.context.scope.environment.lookupOperation(token.op, types);
                        //try to resolve strings to images to find a matching operator
                        if (o == null) {
                            const toResolve = [];
                            for (const i in types) if (types[i] == Types.STRING) {
                                types[i] = Types.IMAGE;
                                toResolve.push(i);
                                o = this.context.scope.environment.lookupOperation(token.op, types);
                                if (o != null) break;
                            }
                            if (o == null) this.context.throw(`Unknown operation ${token.op} for types ${types.map(getTypeName)}`);
                            for (const i of toResolve) {
                                args[i] = await this.loadImage(args[i]);
                            }
                        }
                        return {
                            value: await o.operation(...args),
                            type: o.outputType
                        };
                    }
                    default:
                        this.context.throw(`Unknown expr token '${token.tokenType}'`);
                }
                break;
            }
            default:
                this.context.throw(`Unknown command token '${token.tokenType}'`);
        }
    }

    async executeCommands(scopeType, commands, name, initState = async _ => { }) {
        const newScope = this.context.newScope(scopeType, name);
        await initState(newScope.state);
        this.context.pushScope(newScope);
        let result;
        try {
            for (const command of commands) {
                result = await this.execute(command);
                if (!this.context.scope.isRunning) break;
            }
        }
        catch (err) {
            this.context.popScope();
            throw err;
        }
        this.context.popScope();
        return result;
    }

    async createBlankImage(width, height) {
        return await sharp({
            create: {
                width,
                height,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 1 }
            }
        }).raw().toBuffer({ resolveWithObject: true });
    }

    async loadImage(pathname) {
        try {
            return await sharp(this.options.path + pathname).raw().toBuffer({ resolveWithObject: true });
        }
        catch (err) {
            this.context.throw(err.message);
        }
    }

    async copyImage(image) {
        const { width, height } = image.info;
        return await sharp(image.data.buffer, { raw: { width, height, channels: image.info.channels } }).raw().toBuffer({ resolveWithObject: true });
    }

    async applyElementWiseOperation(op, args) {

        switch (args.length) {
            case 1: {
                const value = args[0];
                const { width, height, channels } = value.info;
                const { data, info } = await this.createBlankImage(width, height);
                const valueTexture = new Uint8ClampedArray(value.data.buffer);
                const texture = new Uint8ClampedArray(data.buffer);
                for (let i = 0; i < width * height * channels; i++) {
                    texture[i] = op(valueTexture[i] / 255) * 255;
                }

                return { data, info };
            }
            case 2: {
                const left = args[0];
                const right = args[1];
                if (right.info.width != left.info.width || right.info.height != left.info.height) {
                    this.context.throw(`Incompatible sizes for operation '${op}': ${right.info.width}x${right.info.height} and ${left.info.width}x${left.info.height}`);
                }
                if (right.info.channels != left.info.channels) {
                    this.context.throw(`Incompatible formats for operation '${op}': ${right.info.channels} and ${left.info.channels}`);
                }

                const { width, height, channels } = left.info;
                const { data, info } = await this.createBlankImage(width, height);
                const leftTexture = new Uint8ClampedArray(left.data.buffer);
                const rightTexture = new Uint8ClampedArray(right.data.buffer);
                const texture = new Uint8ClampedArray(data.buffer);
                for (let i = 0; i < width * height * channels; i++) {
                    texture[i] = op(leftTexture[i] / 255, rightTexture[i] / 255) * 255;
                }
                return { data, info };
            }
            default:
                this.context.throw("Unsupported operation");
        }
    }

    async applyBlending(left, right) {
        return await sharp(left.data.buffer, { raw: { width: left.info.width, height: left.info.height, channels: left.info.channels } })
            .composite([{
                input: right.data.buffer,
                raw: { width: right.info.width, height: right.info.height, channels: right.info.channels },
                blend: "over",
            }])
            .raw()
            .toBuffer({ resolveWithObject: true });
    }

    async applyRotation(image, angle) {
        return await sharp(image.data.buffer, { raw: { width: image.info.width, height: image.info.height, channels: image.info.channels } })
            .rotate(angle * 180 / Math.PI, { color: "#00000000" })
            .raw()
            .toBuffer({ resolveWithObject: true });
    }

    async applyReflect(image, angle) {
        return await sharp(image.data.buffer, { raw: { width: image.info.width, height: image.info.height, channels: image.info.channels } })
            .rotate(-angle * 180 / Math.PI, { color: "#00000000" })
            .flop()
            .rotate(angle * 180 / Math.PI, { color: "#00000000" })
            .raw()
            .toBuffer({ resolveWithObject: true });
    }

    async applyFlop(image) {
        return await sharp(image.data.buffer, { raw: { width: image.info.width, height: image.info.height, channels: image.info.channels } })
            .flop()
            .raw()
            .toBuffer({ resolveWithObject: true });
    }

    async applySharpen(image) {
        return await sharp(image.data.buffer, { raw: { width: image.info.width, height: image.info.height, channels: image.info.channels } })
            .sharpen()
            .raw()
            .toBuffer({ resolveWithObject: true });
    }

    async applyConcat(image0, image1, xRelative, yRelative) {

        const w0 = image0.info.width;
        const h0 = image0.info.height;
        const w1 = image1.info.width;
        const h1 = image1.info.height;

        if (xRelative == 0) {
            if (yRelative == 0) return await this.applyBlending(image0, image1);
            return await sharp(image1.data.buffer, { raw: { width: w1, height: h1, channels: image1.info.channels } })
                .resize(Math.max(w0, w1), h0 + h1, {
                    fit: "contain",
                    position: yRelative < 0 ? "top" : "bottom"
                })
                .composite([{
                    input: image0.data.buffer,
                    raw: { width: w0, height: h0, channels: image0.info.channels },
                    blend: "over",
                    top: yRelative < 0 ? h1 : 0,
                    left: 0,
                }])
                .raw()
                .toBuffer({ resolveWithObject: true });
        }
        else if (yRelative == 0) {
            return await sharp(image1.data.buffer, { raw: { width: w1, height: h1, channels: image1.info.channels } })
                .resize(w0 + w1, Math.max(h0, h1), {
                    fit: "contain",
                    position: xRelative < 0 ? "left" : "right"
                })
                .composite([{
                    input: image0.data.buffer,
                    raw: { width: w0, height: h0, channels: image0.info.channels },
                    blend: "over",
                    left: xRelative < 0 ? w1 : 0,
                    top: 0
                }])
                .raw()
                .toBuffer({ resolveWithObject: true });
        }
        const i = xRelative + 1 + (yRelative + 1) / 2;
        return await sharp(image1.data.buffer, { raw: { width: w1, height: h1, channels: image1.info.channels } })
            .resize(w0 + w1, h0 + h1, {
                fit: "contain",
                position: ["northwest", "southwest", "northeast", "southeast"][i],
                withoutEnlargement: true
            })
            .composite([{
                input: image0.data.buffer,
                raw: { width: w0, height: h0, channels: image0.info.channels },
                blend: "over",
                left: xRelative < 0 ? w1 : 0,
                top: yRelative < 0 ? h1 : 0
            }])
            .raw()
            .toBuffer({ resolveWithObject: true });
    }
}

async function printAst(properties, syntaxFilename, codeFilename) {

    try {
        console.log("Reading syntax...");
        const grammar = await readFile(syntaxFilename, "utf-8");
        const parser = new Parser(Grammars.Custom.getRules(grammar), {});
        console.log(`Reading program "${codeFilename}"...`);
        const program = await readFile(codeFilename, "utf-8");

        const parseTree = parser.getAST(program);

        if (!parseTree) {
            throw "Failed to parse file";
        }
        const ast = buildAst(parseTree);
        console.log("AST: " + JSON.stringify(ast, null, 4));
    }
    catch (err) {
        console.error(err);
    }
}

async function runFile(properties, syntaxFilename, codeFilename) {
    try {
        console.log("Reading syntax...");
        const grammar = await readFile(syntaxFilename, "utf-8");
        const parser = new Parser(Grammars.Custom.getRules(grammar), {});
        console.log(`Reading program "${codeFilename}"...`);
        const program = await readFile(codeFilename, "utf-8");

        const parseTree = parser.getAST(program);

        if (!parseTree) {
            throw "Failed to parse file";
        }
        const ast = buildAst(parseTree);

        console.log("Executing...");

        const engine = new Engine({
            path: properties.imagesPath ?? "examples/simple/images",
            debug: properties.debug
        });

        const result = await engine.execute(ast);
        if (!result) {
            console.log("No results");
        }
        else if (result.type == Types.IMAGE) {
            const image = result.value;
            const { width, height } = image.info;
            await sharp(image.data.buffer, { raw: { width, height, channels: image.info.channels } })
                .png()
                .toFile("out.png");
        }
        else {
            console.log(getVarString(result));
        }
    }
    catch (err) {
        console.error(err);
    }
}

async function repl(properties, syntaxFilename) {
    const grammar = await readFile(syntaxFilename, "utf-8");
    const parser = new Parser(Grammars.Custom.getRules(grammar), {});

    const engine = new Engine({
        path: properties.imagesPath ?? "examples/simple/images",
        debug: properties.debug
    });

    var rl = await import('readline-sync');
    while (true) {
        var line = rl.question("> ");
        if (line == "exit" || line == "stop") {
            return;
        }
        let parseTree = parser.getAST(line);
        if (!parseTree && !line.endsWith(";")) parseTree = parser.getAST(line + ";");
        if (!parseTree) {
            console.log("Failed to parse line");
        }
        else {
            try {
                const ast = buildAst(parseTree, true);
                const result = await engine.execute(ast);
                if (result) {
                    if (result.type == Types.IMAGE) {
                        const image = result.value;
                        const { width, height } = image.info;
                        await sharp(image.data.buffer, { raw: { width, height, channels: image.info.channels } })
                            .png()
                            .toFile("out.png");
                    }
                    else {
                        console.log(getVarString(result));
                    }
                }
            }
            catch (err) {
                console.log(err)
            }
        }
    }

}



const properties = {};

for (const arg of process.argv.slice(2)) {
    const eqi = arg.indexOf("=");
    if (eqi == -1) {
        properties[arg] = null;
    }
    else {
        const key = arg.substring(0, eqi);
        const value = arg.substring(eqi + 1);
        properties[key] = value;
    }
}
if (properties.debug) {
    console.log("Properties", properties);
}

properties.mode = properties.mode?.toLowerCase() ?? "run";

if (properties.help !== undefined) {
    console.log("Usage: ");
    console.log("Properties:");
    for (const e of [
        { name: "test", desc: "Specify test files as input file", usage: "<name_of_test>" },
        { name: "input", desc: "Specify the input file path", usage: "<path_of_file>" },
        { name: "syntax", desc: "Specify the syntax file path", usage: "<path_of_file>" },
        { name: "mode", desc: "Specify the run mode (default: run), when in \"run\" execute the given input, when in \"repl\" starts a REPL environment, when in \"ast\" parses and prints the input's ast tree and return", usage: "{ run | repl | ast }" },
        { name: "imagesPath", desc: "Specify the root directory where images are resolved to", usage: "<path_of_directory>" },
        { name: "debug", desc: "Run in debug mode" },
    ]) {
        console.log(`    ${e.name}${e.usage ? `=${e.usage}` : ""}`);
        console.log(`        ${e.desc}`);
    }
}
else if (properties.mode == "repl") {
    var syntaxFilename = "syntax.ebnf";
    syntaxFilename = "src/simpleSyntax.ebnf";

    if (properties.syntax) syntaxFilename = properties.syntax;

    await repl(properties, syntaxFilename);
}
else {
    var syntaxFilename = "syntax.ebnf";
    var codeFilename = "test.tpl";
    syntaxFilename = "src/simpleSyntax.ebnf";
    codeFilename = "examples/simple/test1.tpl";

    if (properties.test) codeFilename = "examples/simple/" + properties.test + ".tpl";
    else if (properties.input) codeFilename = properties.input;
    if (properties.syntax) syntaxFilename = properties.syntax;

    if (properties.mode == "ast") {
        await printAst(properties, syntaxFilename, codeFilename);
    }
    else if (properties.mode == "run") {
        await runFile(properties, syntaxFilename, codeFilename);
    }
    else {
        console.log("Mode not recognized: " + properties.mode);
    }
}