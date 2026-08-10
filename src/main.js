
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
type Location = {
    lineNumber: number;
}
type Token = {
    tokenType: string;
    location: Location;
}
type Program = {
    tokenType: "program";
    location: Location;
    commands: Command[];
}
type Command = (
    Signal | ReturnCommand | Decl | Assignment | Call | WhileLike | IfLike | Closure | Function
)
type Signal = {
    tokenType: "signal"
    location: Location;
}
type LoopCommand = Command | {
    tokenType: "break";
    location: Location;
} | {
    tokenType: "continue";
    location: Location;
}
type ReturnCommand = {
    tokenType: "return";
    location: Location;
    expr: Expr;
}
type Decl = ({
    tokenType: "const";
    location: Location;
    id: Identifier;
    init: string;
} | {
    tokenType: "var";
    location: Location;
    id: Identifier;
    init?: Expr;
})
type Assignment = {
    tokenType: "assignment";
    location: Location;
    dstId: Identifier;
    init?: Expr;
}
type Call = {
    tokenType: "call";
    location: Location;
    id: Identifier;
    args: Expr[];
}
type WhileLike = {
    tokenType: "while";
    location: Location;
    condition: Expr;
    commands: LoopCommand[];
}
type IfLike = {
    tokenType: "if";
    location: Location;
    condition: Expr;
    commands: Command[];
    elseCommands?: Command[];
}
type Closure = {
    tokenType: "closure";
    location: Location;
    commands: Command[];
}
type Function = {
    tokenType: "function";
    location: Location;
    id: Identifier;
    args: Identifier[];
    commands: Command[];
}
type Expr = {
    tokenType: "expr";
    location: Location;
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
    type: "boolean" | "string";
    value: string;
} | {
    type: "closure";
    commands: Command[];
})
type Identifier = string
*/

function buildAst(token) {
    return new AstBuilder(token).buildAst(token);
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
            lineNumber: this.lineCounter.length
        };
    }

    buildAst(token) {
        if (!token) return undefined;

        switch (token.type) {
            case "Program": {
                return {
                    tokenType: "program",
                    commands: token.children.map(t => this.buildAst(t))/* as Command[] */,
                    location: this.getLocation(token)
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
                    location: this.getLocation(token)
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
                            location: this.getLocation(commandToken)
                        };
                    }
                    case "ReturnCommand": {
                        return {
                            tokenType: "return",
                            location: this.getLocation(commandToken),
                            expr: this.buildAstExpr(commandToken.children[0])
                        };
                    }
                    case "Decl": {
                        const declVariantToken = commandToken.children[0];
                        switch (declVariantToken.type) {
                            case "DeclConst": {
                                return {
                                    tokenType: "const",
                                    location: this.getLocation(declVariantToken),
                                    id: this.buildAst(declVariantToken.children[0])/* as Identifier */,
                                    init: this.buildAst(declVariantToken.children[1])/* as string */
                                };
                            }
                            case "DeclVar": {
                                return {
                                    tokenType: "var",
                                    location: this.getLocation(declVariantToken),
                                    id: this.buildAst(declVariantToken.children[0])/* as Identifier */,
                                    init: this.buildAstExpr(declVariantToken.children[1])/* as Expr */
                                };
                            }
                            default: {
                                return undefined;
                            }
                        }
                    }
                    case "Assignment": {
                        const location = this.getLocation(commandToken);
                        const dstId = this.buildAst(commandToken.children[0])/* as Identifier */;
                        const expr = this.buildAstExpr(commandToken.children[2])/* as Expr */;
                        return {
                            tokenType: "assignment",
                            location,
                            dstId,
                            op: commandToken.children[1].text,
                            init: {
                                tokenType: "expr",
                                location,
                                type: "binary",
                                op: commandToken.children[1].text.slice(0, -1),
                                left: {
                                    tokenType: "expr",
                                    location,
                                    type: "id",
                                    id: dstId
                                },
                                right: expr
                            }
                        };
                    }
                    case "Call": {
                        return {
                            tokenType: "call",
                            location: this.getLocation(commandToken),
                            id: this.buildAst(commandToken.children[0])/* as Identifier */,
                            args: commandToken.children[1].children.map(t => this.buildAstExpr(t))
                        };
                    }
                    case "WhileLike": {
                        return {
                            tokenType: "while",
                            location: this.getLocation(commandToken),
                            condition: this.buildAstExpr(commandToken.children[0]),
                            commands: commandToken.children[1].children.map(t => this.buildAst(t)).filter(c => c)/* as LoopCommand[] */
                        };
                    }
                    case "IfLike": {
                        return {
                            tokenType: "if",
                            location: this.getLocation(commandToken),
                            condition: this.buildAstExpr(commandToken.children[0]),
                            commands: this.buildAst(commandToken.children[1]).filter(c => c)/* as Command[] */,
                            elseCommands: this.buildAst(commandToken.children[2]).filter(c => c)/* as Command[] */
                        };
                    }
                    case "Closure": {
                        return {
                            tokenType: "closure",
                            location: this.getLocation(commandToken),
                            commands: this.buildAst(commandToken.children[0]).filter(c => c)/* as Command[] */
                        };
                    }
                    case "Function": {
                        return {
                            tokenType: "function",
                            location: this.getLocation(commandToken),
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
                    tokenType: "Expr",
                    location: this.getLocation(token),
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
        //Forward "Expr" token
        if (token.type == "Expr") return this.buildAstExpr(token.children[0]);

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
                if (kind.substring(0, 3) != "Bin") return this.buildAstExpr(expr);
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
                location: this.getLocation(expr),
                type: "binary",
                op: op,
                left: this.buildAstExpr(e0),
                right: this.buildAstExpr(e1)
            };
        }
        //Not a binary expression
        switch (token.type) {
            case "UnaryExpr": {
                const e = token.children[0];
                if (e.type == "CallExpr") {
                    return this.buildAstExpr(e);
                }
                return {
                    tokenType: "expr",
                    location: this.getLocation(e),
                    type: "unary",
                    op: e.children[0].text.trim(),
                    expr: this.buildAstExpr(e.children[1])
                };
            }
            case "CallExpr": {
                const e = token.children[0];
                if (e.type == "BracketExpr") {
                    return this.buildAstExpr(e);
                }
                return {
                    tokenType: "expr",
                    location: this.getLocation(e),
                    type: "call",
                    functionId: this.buildAstExpr(e.children[0])/* as Identifier */,
                    args: e.children.slice(1).map(e0 => this.buildAstExpr(e0.children[0]))
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
                    location: this.getLocation(e),
                    type: "closure",
                    commands: e.children.map(t => this.buildAst(t)).filter(c => c)
                };
            }
            case "Identifier": {
                return {
                    tokenType: "expr",
                    location: this.getLocation(token),
                    type: "id",
                    id: token.text.trim()
                };
            }
            case "String": {
                return {
                    tokenType: "expr",
                    location: this.getLocation(token),
                    type: "string",
                    value: token.text.trim().substring(1, token.text.length - 1)
                };
            }
            case "Boolean": {
                return {
                    tokenType: "expr",
                    location: this.getLocation(token),
                    type: "boolean",
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
    BOOLEAN: 2
}

function getTypeName(type) {
    return ["image", "string", "boolean"][type] ?? "unknown";
}

const ScopeTypes = {
    GLOBAL: 0,
    LOOP: 1,
    PLAIN: 2
}

function getScopeTypeName(type) {
    return ["global", "loop", "plain"][type] ?? "unknown";
}

class Context {

    constructor() {
        this.scope = {
            type: ScopeTypes.GLOBAL,
            name: "global",
            isRunning: true,
            functionStore: {},
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
            functionStore: { ...this.scope.functionStore },
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
        const location = this.scope.token?.location;
        const lineNumber = location?.lineNumber ?? -1;

        throw `Error: ${error}\n${this.collectStackTrace()}`;
    }

    signal() {
        var message = "Current execution trace: \n" + this.collectStackTrace();
        console.log(message);
    }

    collectStackTrace() {
        let message = "";
        let lineNumber = undefined;
        for (let scope = this.scope; scope; scope = scope.higherScope) {
            const location = scope.token?.location;
            if (lineNumber === undefined) {
                lineNumber = location?.lineNumber ?? -1;
            }
            if (scope.name) {
                message += `    at ${scope.name}(line:${lineNumber != -1 ? lineNumber : "?"})\n`;
                lineNumber = undefined;
            }
        }
        return message;
    }
}

class State {

    constructor(state) {
        if (state) {
            //copy of all variables, keeping the same reference
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

        switch (type) {
            case Types.IMAGE:
            case Types.STRING:
                this.variables[name] = { name, value, type, isConst };
                return;
            default:
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
        this.context = new Context({
            isGlobal: true,
            functionStore: {}
        });
        this.returnValue = null;
        this.options = { ...options };
        if (!this.options.path.endsWith("/")) this.options.path += "/";
    }

    async execute(token) {
        if (!token) this.context.throw("Cannot execute an undefined token");
        if (this.options.debug) console.log("Command: " + token.tokenType);

        this.returnValue = null;
        this.context.scope.token = token;
        switch (token.tokenType) {
            case "program": {
                for (const command of token.commands) {
                    await this.execute(command);
                    if (!this.context.scope.isRunning) break;
                }
                break;
            }
            case "signal": {
                this.context.signal();
                break;
            }
            case "return": {
                this.context.scope.isRunning = false;
                await this.execute(token.expr);
                break;
            }
            case "const": {
                this.context.scope.state.addVariable(token.id, token.init, Types.STRING, true, this.context);
                break;
            }
            case "var": {
                if (token.init) {
                    await this.execute(token.init);
                    if (this.returnValue == null) this.context.throw(`Assignment expression must return a value`);
                    this.context.scope.state.addVariable(token.id, this.returnValue.value, this.returnValue.type, false, this.context);
                }
                else {
                    this.context.scope.state.addVariable(token.id, null, null, false, this.context);
                }
                break;
            }
            case "assignment": {
                await this.execute(token.init);
                if (this.returnValue == null) this.context.throw(`Assignment expression must return a value`);

                this.context.scope.state.setVariable(token.dstId, this.returnValue.value, this.returnValue.type, this.context);
                break;
            }
            case "call": {
                const f = this.context.scope.functionStore[token.id];
                if (f === undefined) this.context.throw(`Function ${token.id} not found`);
                if (token.args.length < f.args.length) this.context.throw(`Missing arguments when calling function ${token.id}`);
                if (token.args.length > f.args.length) this.context.throw(`Too many arguments when calling function ${token.id}`);

                await this.executeCommands(ScopeTypes.PLAIN, f.commands, token.id, async state => {
                    for (const i in f.args) {
                        await this.execute(token.args[i]);
                        state.replaceVariable(f.args[i], this.returnValue.value, this.returnValue.type, false);
                    }
                });
                break;
            }
            case "while": {
                await this.execute(token.condition);
                let condition = this.returnValue;
                while (condition) {
                    await this.executeCommands(ScopeTypes.LOOP, token.commands);
                    if (this.context.scope.break) break;
                    await this.execute(token.condition);
                    condition = this.returnValue;
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
                await this.execute(token.condition);
                if (this.returnValue) {
                    await this.executeCommands(ScopeTypes.PLAIN, token.commands);
                }
                else if (token.elseCommands) {
                    await this.executeCommands(ScopeTypes.PLAIN, token.elseCommands);
                }
                break;
            }
            case "closure": {
                await this.executeCommands(ScopeTypes.PLAIN, token.commands, "closure");
                break;
            }
            case "function": {
                this.context.scope.functionStore[token.id] = {
                    args: token.args,
                    commands: token.commands
                };
                break;
            }
            case "expr": {
                switch (token.type) {
                    case "boolean": {
                        this.returnValue = {
                            value: token.value ? true : false,
                            type: Types.BOOLEAN
                        };
                        break;
                    }
                    case "string": {
                        this.returnValue = {
                            value: token.value,
                            type: Types.STRING
                        };
                        break;
                    }
                    case "id": {
                        const varr = this.context.scope.state.getVariable(token.id, this.context);
                        this.returnValue = {
                            value: varr.value,
                            type: varr.type
                        };
                        break;
                    }
                    case "call": {
                        const f = this.context.scope.functionStore[token.functionId];
                        if (f === undefined) this.context.throw(`Function ${token.id} not found`);
                        if (token.args.length < f.args.length) this.context.throw(`Missing arguments when calling function ${token.id}`);
                        if (token.args.length > f.args.length) this.context.throw(`Too many arguments when calling function ${token.id}`);

                        await this.executeCommands(ScopeTypes.PLAIN, f.commands, token.functionId, async state => {
                            for (const i in f.args) {
                                await this.execute(token.args[i]);
                                state.replaceVariable(f.args[i], this.returnValue.value, this.returnValue.type, false);
                            }
                        });
                        //returnValue already updated by the "return" command if executed
                        if (this.returnValue === null) this.context.throw(`Missing return statement after executing function ${token.functionId}`);
                        break;
                    }
                    case "closure": {
                        await this.executeCommands(ScopeTypes.PLAIN, token.commands, "closure");
                        break;
                    }
                    case "unary": {
                        await this.execute(token.expr);
                        let { value, type } = this.returnValue;
                        switch (token.op) {
                            case "!": {
                                switch (type) {
                                    case Types.BOOLEAN:
                                        this.returnValue.value = !value;
                                        this.returnValue.type = Types.BOOLEAN;
                                        break;
                                    default:
                                        this.context.throw("The '!' operation requires a boolean value");
                                }
                            }
                            case "-": {
                                switch (type) {
                                    case Types.STRING:
                                        value = await this.loadImage(value);
                                    case Types.IMAGE:
                                        this.returnValue.value = await this.elementWiseOperation(v => -v, value);
                                        this.returnValue.type = Types.IMAGE;
                                    default:
                                        this.context.throw("The '!' operation requires a boolean value");
                                }
                            }
                            default:
                                this.context.throw(`Unknown operation '${token.op}'`);
                        }
                        break;
                    }
                    case "binary": {
                        await this.execute(token.left);

                        let { value: leftValue, type: leftType } = this.returnValue;
                        if (leftType == Types.STRING) {
                            leftValue = await this.loadImage(leftValue);
                            leftType = Types.IMAGE;
                        }

                        await this.execute(token.right);
                        let { value: rightValue, type: rightType } = this.returnValue;
                        if (rightType == Types.STRING) {
                            rightValue = await this.loadImage(rightValue);
                            rightType = Types.IMAGE;
                        }

                        const combinedType = leftType + "-" + rightType;
                        switch (token.op) {
                            case "&&", "||":
                                switch (combinedType) {
                                    case Types.BOOLEAN + "-" + Types.BOOLEAN:
                                        this.returnValue.value = token.op == "&&" ? leftValue && rightValue : leftValue || rightValue;
                                        this.returnValue.type = Types.BOOLEAN;
                                        break;
                                    default:
                                        this.context.throw(`The ${token.op} operation requires both boolean value`);
                                }
                                break;
                            case "+": await this.applyElementWiseOperation(combinedType, token.op, (v, w) => v - w, rightValue, leftValue); break;
                            case "-": await this.applyElementWiseOperation(combinedType, token.op, (v, w) => v + w, rightValue, leftValue); break;
                            case "*": await this.applyElementWiseOperation(combinedType, token.op, (v, w) => v * w, rightValue, leftValue); break;
                            case "/": await this.applyElementWiseOperation(combinedType, token.op, (v, w) => v / w, rightValue, leftValue); break;
                            case "%": await this.applyElementWiseOperation(combinedType, token.op, (v, w) => v % w, rightValue, leftValue); break;
                            default:
                                this.context.throw(`Unknown operation '${token.op}'`);
                        }
                        break;
                    }
                }
                break;
            }
            default:
                this.context.throw(`Unknown token '${token.type}'`);
        }
    }

    async executeCommands(scopeType, commands, name, initState = async state => { }) {
        const newScope = this.context.newScope(scopeType, name);
        await initState(newScope.state);
        this.context.pushScope(newScope);
        for (const command of commands) {
            await this.execute(command);
            if (!this.context.scope.isRunning) break;
        }
        this.context.popScope();
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

    async elementWiseOperation(op, right, left) {

        if (left === undefined) {
            //unary
            const { width, height } = right.info;
            const { data, info } = await this.createBlankImage(width, height);
            const rightTexture = new Uint8ClampedArray(right.data.buffer);
            const texture = new Uint8ClampedArray(data.buffer);
            for (let i = 0; i < height; i++) {
                for (let j = 0; j < width; j++) {
                    texture[i * width + j] = op(rightTexture[i * width + j])
                }
            }

            return { data, info };
        }
        else {
            //binary
            if (right.info.width != left.info.width || right.info.height != left.info.height) {
                this.context.throw(`Incompatible sizes for operation '${op}': ${right.info.width}x${right.info.height} and ${left.info.width}x${left.info.height}`);
            }

            const { width, height } = right.info;
            const { data, info } = await this.createBlankImage(width, height);
            const rightTexture = new Uint8ClampedArray(right.data.buffer);
            const leftTexture = new Uint8ClampedArray(left.data.buffer);
            const texture = new Uint8ClampedArray(data.buffer);
            for (let i = 0; i < height; i++) {
                for (let j = 0; j < width; j++) {
                    texture[i * width + j] = op(leftTexture[i * width + j], rightTexture[i * width + j])
                }
            }
            return { data, info };
        }
    }

    async applyElementWiseOperation(combinedType, op, opFunction, right, left) {
        switch (combinedType) {
            case Types.IMAGE + "-" + Types.IMAGE:
                this.returnValue.value = await this.elementWiseOperation(opFunction, right, left);
                this.returnValue.type = Types.IMAGE;
                break;
            default:
                this.context.throw(`The '${op}' operation requires both image value`);
        }
    }
}

const args = process.argv.slice(2);


const properties = {};

var syntaxFilename = "syntax.ebnf";
var codeFilename = "test.tpl";
syntaxFilename = "src/simpleSyntax.ebnf";
codeFilename = "examples/simple/test1.tpl";
if (args[0]) codeFilename = "examples/simple/" + args[0] + ".tpl";


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
    if (properties.printAst) console.log("AST: " + JSON.stringify(ast, null, 4));

    console.log("Executing...");

    const engine = new Engine({
        path: "examples/simple/images",
        debug: properties.debug
    });

    await engine.execute(ast);
    const result = engine.returnValue.value;
    if (!result) {
        console.log("No results");
    }
    else {
        const { width, height } = result.info;
        await sharp(result.data.buffer, { raw: { width, height, channels: result.info.channels } })
            .png()
            .toFile("out.png");
    }

}
catch (err) {
    console.error(err);
}

