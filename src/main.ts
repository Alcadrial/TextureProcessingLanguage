
import { readFile } from "node:fs/promises";
import { Grammars, IToken, Parser } from "ebnf";
import sharp, { OutputInfo } from "sharp"
import { randomInt } from "node:crypto";

declare type ColorLike = import('@img/colour').ColorLike;

type Properties = {
    [key: string]: string | null | undefined;
};

type Location = {
    lineNumber?: number;
}
type DebugData = {
    location?: Location;
    text: string;
}
interface Token {
    debugData: DebugData;
    type: string;
}
interface Program extends Token {
    commands: Command[];
}
type Command = (
    Signal | ReturnCommand | Decl | Assignment | Call | WhileLike | IfLike | Closure | Function
)
interface LoopCommand extends Token {
    kind: "break" | "continue";
}
interface Signal extends Token {
    debugData: DebugData;
    message?: string;
}
interface Print extends Token {
    debugData: DebugData;
    message: string;
    args: Expr[];
}
interface ReturnCommand extends Token {
    debugData: DebugData;
    expr: Expr;
}
interface DeclConst extends Token {
    debugData: DebugData;
    id: Identifier;
    init: Expr;
}
interface DeclVar extends Token {
    debugData: DebugData;
    id: Identifier;
    init?: Expr;
}
type Decl = DeclConst | DeclVar;
interface Assignment extends Token {
    dstId: Identifier;
    range?: Expr[];
    init: Expr;
}
interface Call extends Token {
    id: Identifier;
    args: Expr[];
}
interface WhileLike extends Token {
    condition: Expr;
    commands: LoopCommand[];
}
interface IfLike extends Token {
    condition: Expr;
    commands: Command[];
    elseCommands?: Command[];
}
interface Closure extends Token {
    commands: Command[];
}
interface Function extends Token {
    id: Identifier;
    args: Identifier[];
    commands: Command[];
}
interface Expr extends Token {
    exprType: string;
}
interface OperationExpr extends Expr {
    op: string;
    exprs: Expr[];
}
interface CallExpr extends Expr {
    functionId: Identifier;
    args: Expr[];
}
interface IdExpr extends Expr {
    id: Identifier;
}
interface ValueExpr extends Expr {
    valueType: "boolean" | "string" | "number";
    value: string;
}
interface ClosureExpr extends Expr {
    commands: Command[];
}
type Identifier = string

type Image = {
    data: Buffer<ArrayBuffer>;
    info: OutputInfo;
};
type Point = {
    x: number;
    y: number;
}
type Range = {
    from: Point;
    to: Point;
};

function isRangeEmpty(range: Range) {
    return range.to.x <= range.from.x || range.to.y <= range.from.y
}

function buildAst(token: IToken, allowFullExpr = false) {
    return new AstBuilder(token).buildAst(token, allowFullExpr);
}

class AstBuilder {

    private text: string;
    private lineCounter: number[];

    constructor(token: IToken) {
        this.text = token.text;
        this.lineCounter = [];
        let i = 0;
        for (const c of this.text) {
            if (c == '\n') this.lineCounter.push(i);
            i++;
        }
    }

    getLocation(token: IToken) {
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

    getDebugData(token: IToken) {
        let text = token.text.trim();
        return {
            location: this.getLocation(token),
            text: text.length < 30 ? text : text.substring(0, 27) + "..."
        };
    }

    public buildAst(token?: IToken, allowFullExpr = false): Token | Command[] | string | undefined {
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
                    type: "program",
                    commands: token.children.map(t => this.buildAst(t)) as Command[],
                    debugData: this.getDebugData(token)
                } as Program;
            }
            case "LoopCommand":
                switch (token.children[0].type) {
                    case "Command":
                        return this.buildAst(token.children[0]) as Command;
                    case "LoopFlowCommand": {
                        const token0 = token.children[0];
                        return {
                            type: "loopFlowCommand",
                            debugData: this.getDebugData(token),
                            kind: token0.text
                        } as LoopCommand;
                    }
                    default:
                        return undefined;
                }
            case "Command": {
                const commandToken = token.children[0];
                const type = commandToken.type;

                switch (type) {
                    case "Nop":
                        return undefined;
                    case "Signal":
                        return {
                            type: "signal",
                            debugData: this.getDebugData(commandToken),
                            message: this.buildAst(commandToken.children[0]) as string
                        } as Signal;
                    case "Print":
                        return {
                            type: "print",
                            debugData: this.getDebugData(commandToken),
                            message: this.buildAst(commandToken.children[0]) as string,
                            args: commandToken.children[1].children.map(t => this.buildAstExpr(t))
                        } as Print;
                    case "ReturnCommand":
                        return {
                            type: "return",
                            debugData: this.getDebugData(commandToken),
                            expr: this.buildAstExpr(commandToken.children[0])
                        } as ReturnCommand;
                    case "Decl": {
                        const declVariantToken = commandToken.children[0];
                        switch (declVariantToken.type) {
                            case "DeclConst": {
                                return {
                                    type: "const",
                                    debugData: this.getDebugData(declVariantToken),
                                    id: this.buildAst(declVariantToken.children[0]),
                                    init: this.buildAstExpr(declVariantToken.children[1])/* as Expr */
                                } as DeclConst;
                            }
                            case "DeclVar": {
                                return {
                                    type: "var",
                                    debugData: this.getDebugData(declVariantToken),
                                    id: this.buildAst(declVariantToken.children[0]),
                                    init: declVariantToken.children[1] ? this.buildAstExpr(declVariantToken.children[1]) : null/* as Expr */
                                } as DeclVar;
                            }
                            default: {
                                return undefined;
                            }
                        }
                    }
                    case "Assignment": {
                        const debugData = this.getDebugData(commandToken);
                        const dstId = this.buildAst(commandToken.children[0]);
                        var assignOpIndex = 1;
                        var exprIndex = 2;
                        var range: Expr[] | undefined;
                        if (commandToken.children[1].type == "RangedAssign") {
                            assignOpIndex = 2;
                            exprIndex = 3;
                            range = commandToken.children[1].children.map(e0 => this.buildAstExpr(e0) as Expr);
                        }
                        const assignOp = commandToken.children[assignOpIndex];
                        const expr = this.buildAstExpr(commandToken.children[exprIndex]);
                        return {
                            type: "assignment",
                            debugData,
                            dstId,
                            range,
                            op: assignOp.text,
                            init: assignOp.children[0] ? {
                                type: "expr",
                                debugData,
                                exprType: "operation",
                                op: assignOp.children[0].text,
                                exprs: [{
                                    type: "expr",
                                    debugData,
                                    exprType: "id",
                                    id: dstId
                                }, expr],
                            } : expr
                        } as Assignment;
                    }
                    case "Call":
                        return {
                            type: "call",
                            debugData: this.getDebugData(commandToken),
                            id: this.buildAst(commandToken.children[0])/* as Identifier */,
                            args: commandToken.children[1].children.map(t => this.buildAstExpr(t))
                        } as Call;
                    case "WhileLike":
                        return {
                            type: "while",
                            debugData: this.getDebugData(commandToken),
                            condition: this.buildAstExpr(commandToken.children[0]),
                            commands: commandToken.children[1].children.map(t => this.buildAst(t)).filter(c => c) as LoopCommand[]
                        } as WhileLike;
                    case "IfLike":
                        return {
                            type: "if",
                            debugData: this.getDebugData(commandToken),
                            condition: this.buildAstExpr(commandToken.children[0]),
                            commands: (this.buildAst(commandToken.children[1]) as Command[]).filter(c => c),
                            elseCommands: (this.buildAst(commandToken.children[2]) as Command[] | undefined)?.filter(c => c)
                        } as IfLike;
                    case "Closure":
                        return {
                            type: "closure",
                            debugData: this.getDebugData(commandToken),
                            commands: commandToken.children.map(t => this.buildAst(t)).filter(c => c)
                        } as Closure;
                    case "Function":
                        return {
                            type: "function",
                            debugData: this.getDebugData(commandToken),
                            id: this.buildAst(commandToken.children[0]),
                            args: commandToken.children[1].children.map(t => this.buildAst(t)),
                            commands: (this.buildAst(commandToken.children[2]) as Command[]).filter(c => c)
                        } as Function;
                    default:
                        return undefined;
                }
            }
            case "Expr":
                return this.buildAstExpr(token.children[0]);
            case "Exec": {
                const execToken = token.children[0];
                if (execToken.type == "Closure") {
                    return execToken.children.map(t => this.buildAst(t)).filter(c => c) as Command[];
                }
                return [this.buildAst(execToken) as Command];
            }
            case "Identifier":
                return token.text.trim();
            case "String":
                return token.text.trim().substring(1, token.text.length - 1);
            default:
                console.log("Unknown token " + token.type);
                return undefined;
        }
    }
    //Tries to parse a "Program" token
    //Tries to parse an "Expr" token or any component of it, pruning meaningless tokens
    buildAstExpr(token: IToken): Expr | undefined {
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
                type: "expr",
                debugData: this.getDebugData(expr),
                exprType: "operation",
                op: expr.children[1].text,
                exprs: [this.buildAstExpr(e0), this.buildAstExpr(e2)]
            } as OperationExpr;
        }
        //Search for an unary expression
        switch (token.type) {
            case "UnaryExpr": {
                const e = token.children[0];
                if (e.type == "RangeExpr") {
                    return this.buildAstExpr(e);
                }
                return {
                    type: "expr",
                    debugData: this.getDebugData(token),
                    exprType: "operation",
                    op: e.text.trim(),
                    exprs: [this.buildAstExpr(token.children[1])]
                } as OperationExpr;
            }
            case "RangeExpr":
                if (token.children.length == 1) {
                    return this.buildAstExpr(token.children[0]);
                }
                return {
                    type: "expr",
                    debugData: this.getDebugData(token),
                    exprType: "operation",
                    op: "[->]",
                    exprs: token.children.map(e0 => this.buildAstExpr(e0))
                } as OperationExpr;
            case "ResizeExpr":
                if (token.children.length == 1) {
                    return this.buildAstExpr(token.children[0]);
                }
                return {
                    type: "expr",
                    debugData: this.getDebugData(token),
                    exprType: "operation",
                    op: "{}",
                    exprs: token.children.map(e0 => this.buildAstExpr(e0))
                } as OperationExpr;
            /*
            case "PostfixUnaryExpr": {

                const e = token.children[1];
                if (!e) {
                    return this.buildAstExpr(token.children[0]);
                }
                return {
                    debugData: this.getDebugData(token),
                    op: e.text.trim(),
                    exprs: [baseExpr, this.buildAstExpr(token.children[1])]
                } as OperationExpr;
            }*/
            case "CallExpr": {
                const e = token.children[0];
                if (e.type == "BracketExpr") {
                    return this.buildAstExpr(e);
                }
                return {
                    type: "expr",
                    debugData: this.getDebugData(token),
                    exprType: "call",
                    functionId: this.buildAst(token.children[0]),
                    args: token.children[1].children.map(e0 => this.buildAstExpr(e0))
                } as CallExpr;
            }
            case "BracketExpr":
                return this.buildAstExpr(token.children[0]);
            case "ClosureExpr": {
                const e = token.children[0];
                if (e.type == "Value") {
                    return this.buildAstExpr(e.children[0])
                }
                return {
                    type: "expr",
                    debugData: this.getDebugData(token),
                    exprType: "closure",
                    commands: e.children.map(t => this.buildAst(t)).filter(c => c)
                } as ClosureExpr;
            }
            case "Identifier":
                return {
                    type: "expr",
                    debugData: this.getDebugData(token),
                    exprType: "id",
                    id: token.text.trim()
                } as IdExpr;
            case "String":
                return {
                    type: "expr",
                    debugData: this.getDebugData(token),
                    exprType: "string",
                    value: token.text.trim().substring(1, token.text.length - 1)
                } as ValueExpr;
            case "Boolean":
                return {
                    type: "expr",
                    debugData: this.getDebugData(token),
                    exprType: "boolean",
                    value: token.text.trim()
                } as ValueExpr;
            case "Float":
            case "Int":
                return {
                    type: "expr",
                    debugData: this.getDebugData(token),
                    exprType: "number",
                    value: token.text.trim()
                } as ValueExpr;
            default:
                console.log("Unknown expr token " + token.type);
        }
    }
}

enum Type {
    IMAGE,
    EMPTY,
    STRING,
    BOOLEAN,
    NUMBER
}

type Variable = {
    type: Type,
    value: any
};

function getTypeName(type: Type) {
    return ["image", "empty", "string", "boolean", "number"][type] ?? "unknown";
}

enum ScopeType {
    GLOBAL,
    LOOP,
    PLAIN,
    CLOSURE
}

function getScopeTypeName(type: ScopeType) {
    return ["global", "loop", "plain", "closure"][type] ?? "unknown";
}

function getVarString(variable: Variable) {

    switch (variable.type) {
        case Type.BOOLEAN:
        case Type.NUMBER:
        case Type.STRING:
            return variable.value;
        case Type.IMAGE:
            const info = variable.value.info;
            return `{Image ${info.width}x${info.height}}`;
        case Type.EMPTY:
            return "empty";
        default:
            return "{unknown object}";
    }
}

type Scope = {
    type: ScopeType,
    name: string,
    isRunning: boolean,
    return: boolean,
    break?: true,
    environment: Environment,
    higherScope: Scope | null,
    token?: Token,
    state: State
};

class Context {

    public scope: Scope;

    constructor() {
        this.scope = {
            type: ScopeType.GLOBAL,
            name: "global",
            isRunning: true,
            return: false,
            environment: new Environment(),
            higherScope: null,
            token: undefined,
            state: new State()
        };
    }

    newScope(type: ScopeType, name: string): Scope {
        return {
            type: type,
            name: name,
            isRunning: true,
            return: false,
            environment: new Environment(this.scope.environment),
            higherScope: this.scope,
            token: undefined,
            state: new State(this.scope.state)
        };
    }

    pushScope(typeOrScope: Scope) {
        this.scope = typeOrScope;
    }

    popScope() {
        if (!this.scope.higherScope) throw ("Internal Error: missing higher scope");
        this.scope = this.scope.higherScope;
    }

    throw(error: string): any {
        const debugData = this.scope.token?.debugData;
        const lineNumber = debugData?.location?.lineNumber ?? -1;

        throw `Error: ${error}\n${this.collectStackTrace()}`;
    }

    signal(message?: string) {
        if (message === undefined) message = "Current execution trace";
        message += ": \n" + this.collectStackTrace();
        console.log(message);
    }

    collectStackTrace() {
        let message = "";
        let lineNumber: number | undefined = undefined;
        for (let scope: Scope | null = this.scope; scope; scope = scope.higherScope) {
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

type EnvironmentFunction = {
    builtin: false;
    args: string[];
    commands: Command[];
} | {
    builtin: true;
    types: Type[];
    returnType: Type;
    handle: (args: any[]) => any;
};

class Environment {

    private operations: { [key: string]: { operation: (args: any[]) => any, outputType: Type } };
    private functions: { [key: string]: EnvironmentFunction };

    constructor(environment?: Environment) {
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

    bindOperation(name: string, inputTypes: Type[], outputType: Type, op: (args: any[]) => any) {
        this.operations[`${name} ${inputTypes}`] = {
            operation: op,
            outputType
        };
    }

    lookupOperation(name: string, inputTypes: Type[]) {
        return this.operations[`${name} ${inputTypes}`];
    }

    bindFunctions(name: string, f: EnvironmentFunction, context: Context) {
        if (this.functions[name]) context.throw(`Cannot replace previous defined function "${name}"`);
        this.functions[name] = f;
    }

    lookupFunction(name: string) {
        return this.functions[name];
    }
}

class State {

    private variables: {
        [key: string]: {
            name: string;
            value: any;
            type: Type;
            isConst: boolean;
        } | {
            name: string;
            value: null;
            type: null;
            isConst: false;
        } | undefined;
    };
    private builtinVariables: {
        [key: string]: {
            name: string;
            type: Type;
        } | undefined;
    };

    constructor(state?: State) {
        if (state) {
            //copy of all variables
            this.variables = { ...state.variables };
        }
        else {
            this.variables = {};
        }
        //init built-in variables
        this.builtinVariables = {
            empty: {
                name: "empty",
                type: Type.EMPTY
            }
        };
    }

    addVariable(name: string, value: any, type: Type | null, isConst: boolean, context: Context) {
        if (Object.keys(this.builtinVariables).indexOf(name) != -1) context.throw(`Cannot redeclare a built-in variable: ${name}`);
        if (this.variables[name]) context.throw("Duplicate declaration of " + name);
        if (isConst) {
            if ((value === null && type != Type.EMPTY) || value === undefined || type === null) return context.throw("Cannot declare a const variable without initialization (" + name + ")");
            this.variables[name] = { name, value, type, isConst };
            return;
        }
        if (type === null) {
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

    setVariable(name: string, value: any, type: Type, context: Context, dryRun = false) {
        if (Object.keys(this.builtinVariables).indexOf(name) != -1) context.throw(`Cannot redeclare a built-in variable: ${name}`);
        const varr = this.variables[name];
        if (!varr) return context.throw(`Missing declaration of ${name}`);
        if (!this.isAssignableTo(type, varr.type)) context.throw(`Incompatible assignment of type ${type} into a variable of type ${varr.type}`);
        varr.value = value;
        varr.type = type;
    }

    isAssignableTo(valueType: Type, varType: Type | null) {
        if (varType == null) {
            return true;
        }
        if (valueType == varType) return true;
        if (varType == Type.STRING && valueType == Type.IMAGE) return true;
        if (varType == Type.EMPTY && valueType == Type.IMAGE) return true;
        if (varType == Type.IMAGE && valueType == Type.EMPTY) return true;
        return false;
    }

    replaceVariable(name: string, value: any, type: Type, isConst: boolean, context: Context) {
        if (Object.keys(this.builtinVariables).indexOf(name) != -1) context.throw(`Cannot redeclare a built-in variable: ${name}`);
        this.variables[name] = {
            name,
            value,
            type,
            isConst
        };
    }

    getVariable(name: string, context: Context): {
        name: string;
        type: Type;
    } | {
        name: string;
        value: any;
        type: Type;
        isConst: boolean;
    } | {
        name: string;
        value: null;
        type: null;
        isConst: false;
    } {
        const varr = this.builtinVariables[name] ?? this.variables[name];
        if (!varr) return context.throw(`Variable ${name} not declared`);
        return varr;
    }
}

type EngineOption = { path: string, debug: boolean, angleUnit: number };

class Engine {

    private context: Context;
    private options: EngineOption;

    constructor(options: { path?: string, debug?: boolean, angleUnit?: number }) {
        this.context = new Context();
        (e => {
            e.bindOperation("!", [Type.BOOLEAN], Type.BOOLEAN, ([v]) => !v);
            e.bindOperation("-", [Type.NUMBER], Type.NUMBER, ([v]) => -v);
            e.bindOperation("|", [Type.IMAGE], Type.IMAGE, async ([v]) => await this.applyFlop(v));
            e.bindOperation("#", [Type.IMAGE], Type.IMAGE, async ([v]) => await this.applySharpen(v));

            e.bindOperation("==", [Type.NUMBER, Type.NUMBER], Type.BOOLEAN, ([v, w]) => v == w);
            e.bindOperation("==", [Type.BOOLEAN, Type.BOOLEAN], Type.BOOLEAN, ([v, w]) => v == w);
            e.bindOperation("!=", [Type.NUMBER, Type.NUMBER], Type.BOOLEAN, ([v, w]) => v != w);
            e.bindOperation("!=", [Type.BOOLEAN, Type.BOOLEAN], Type.BOOLEAN, ([v, w]) => v != w);
            e.bindOperation(">=", [Type.NUMBER, Type.NUMBER], Type.BOOLEAN, ([v, w]) => v >= w);
            e.bindOperation(">", [Type.NUMBER, Type.NUMBER], Type.BOOLEAN, ([v, w]) => v > w);
            e.bindOperation("<=", [Type.NUMBER, Type.NUMBER], Type.BOOLEAN, ([v, w]) => v <= w);
            e.bindOperation("<", [Type.NUMBER, Type.NUMBER], Type.BOOLEAN, ([v, w]) => v < w);
            e.bindOperation("&&", [Type.BOOLEAN, Type.BOOLEAN], Type.BOOLEAN, ([v, w]) => v && w);
            e.bindOperation("||", [Type.BOOLEAN, Type.BOOLEAN], Type.BOOLEAN, ([v, w]) => v || w);
            e.bindOperation("+", [Type.NUMBER, Type.NUMBER], Type.NUMBER, ([v, w]) => v + w);
            e.bindOperation("-", [Type.NUMBER, Type.NUMBER], Type.NUMBER, ([v, w]) => v - w);
            e.bindOperation("*", [Type.NUMBER, Type.NUMBER], Type.NUMBER, ([v, w]) => v * w);
            e.bindOperation("/", [Type.NUMBER, Type.NUMBER], Type.NUMBER, ([v, w]) => v / w);
            e.bindOperation("%", [Type.NUMBER, Type.NUMBER], Type.NUMBER, ([v, w]) => v % w);

            e.bindOperation("+", [Type.IMAGE, Type.IMAGE], Type.IMAGE, async ([v, w]) => await this.applyElementWiseOperation((c0, c1) => c0 + c1, "+", [v, w]));
            e.bindOperation("-", [Type.IMAGE, Type.IMAGE], Type.IMAGE, async ([v, w]) => await this.applyElementWiseOperation((c0, c1) => c0 - c1, "-", [v, w]));
            e.bindOperation("*", [Type.IMAGE, Type.IMAGE], Type.IMAGE, async ([v, w]) => await this.applyElementWiseOperation((c0, c1) => c0 * c1, "*", [v, w]));
            e.bindOperation("/", [Type.IMAGE, Type.IMAGE], Type.IMAGE, async ([v, w]) => await this.applyElementWiseOperation((c0, c1) => c0 / c1, "/", [v, w]));
            e.bindOperation("%", [Type.IMAGE, Type.IMAGE], Type.IMAGE, async ([v, w]) => await this.applyElementWiseOperation((c0, c1) => c0 % c1, "%", [v, w]));
            e.bindOperation("**", [Type.IMAGE, Type.IMAGE], Type.IMAGE, async ([v, w]) => await this.applyBlending(v, w));

            e.bindOperation("@", [Type.IMAGE, Type.NUMBER], Type.IMAGE, async ([v, i]) => await this.applyRotation(v, i));
            e.bindOperation("!@", [Type.IMAGE, Type.NUMBER], Type.IMAGE, async ([v, i]) => await this.applyRotation(v, -i));

            e.bindOperation("|<", [Type.IMAGE, Type.IMAGE], Type.IMAGE, async ([v, w]) => await this.applyConcat(v, w, -1, 0));
            e.bindOperation("|>", [Type.IMAGE, Type.IMAGE], Type.IMAGE, async ([v, w]) => await this.applyConcat(v, w, 1, 0));
            e.bindOperation("|v", [Type.IMAGE, Type.IMAGE], Type.IMAGE, async ([v, w]) => await this.applyConcat(v, w, 0, 1));
            e.bindOperation("|^", [Type.IMAGE, Type.IMAGE], Type.IMAGE, async ([v, w]) => await this.applyConcat(v, w, 0, -1));
            e.bindOperation("|<^", [Type.IMAGE, Type.IMAGE], Type.IMAGE, async ([v, w]) => await this.applyConcat(v, w, -1, -1));
            e.bindOperation("|<v", [Type.IMAGE, Type.IMAGE], Type.IMAGE, async ([v, w]) => await this.applyConcat(v, w, -1, 1));
            e.bindOperation("|>v", [Type.IMAGE, Type.IMAGE], Type.IMAGE, async ([v, w]) => await this.applyConcat(v, w, 1, 1));
            e.bindOperation("|>^", [Type.IMAGE, Type.IMAGE], Type.IMAGE, async ([v, w]) => await this.applyConcat(v, w, 1, -1));

            e.bindOperation("[->]", [Type.IMAGE, Type.NUMBER, Type.NUMBER, Type.NUMBER, Type.NUMBER], Type.IMAGE, async ([v, x0, y0, x1, y1]) => await this.applyRange(v, { from: { x: x0, y: y0 }, to: { x: x1, y: y1 } }, "#00000000"));
            e.bindOperation("[->]", [Type.IMAGE, Type.NUMBER, Type.NUMBER, Type.NUMBER, Type.NUMBER, Type.STRING], Type.IMAGE, async ([v, x0, y0, x1, y1, c]) => await this.applyRange(v, { from: { x: x0, y: y0 }, to: { x: x1, y: y1 } }, c));
            e.bindOperation("[->]", [Type.EMPTY, Type.NUMBER, Type.NUMBER, Type.NUMBER, Type.NUMBER], Type.IMAGE, async ([, x0, y0, x1, y1]) => await this.createBlankImage(x1 - x0, y1 - y0));
            e.bindOperation("[->]", [Type.EMPTY, Type.NUMBER, Type.NUMBER, Type.NUMBER, Type.NUMBER, Type.STRING], Type.IMAGE, async ([, x0, y0, x1, y1, c]) => await this.createBlankImage(x1 - x0, y1 - y0, c));
            e.bindOperation("{}", [Type.IMAGE, Type.NUMBER, Type.NUMBER], Type.IMAGE, async ([v, w, h]) => await this.applyResize(v, w, h, "nearest"));
            e.bindOperation("{}", [Type.IMAGE, Type.NUMBER, Type.NUMBER, Type.STRING], Type.IMAGE, async ([v, w, h, s]) => await this.applyResize(v, w, h, s));
            e.bindOperation("{}", [Type.EMPTY, Type.NUMBER, Type.NUMBER], Type.IMAGE, async ([, w, h]) => await this.createBlankImage(w, h));
            e.bindOperation("{}", [Type.EMPTY, Type.NUMBER, Type.NUMBER, Type.STRING], Type.IMAGE, async ([, w, h, s]) => await this.createBlankImage(w, h, s));

            e.bindFunctions("width", {
                builtin: true,
                types: [Type.IMAGE],
                returnType: Type.NUMBER,
                handle: ([image]) => image.info.width
            }, this.context);
            e.bindFunctions("height", {
                builtin: true,
                types: [Type.IMAGE],
                returnType: Type.NUMBER,
                handle: ([image]) => image.info.height
            }, this.context);
            e.bindFunctions("random", {
                builtin: true,
                types: [],
                returnType: Type.NUMBER,
                handle: () => randomInt(2 ** 32)
            }, this.context);

        })(this.context.scope.environment);

        options = { ...options };
        if (!options.path?.endsWith("/")) options.path += "/";
        if (!options.angleUnit) options.angleUnit = 180 / Math.PI;
        this.options = options as EngineOption;
    }

    async execute(token: Token): Promise<Variable | undefined> {
        if (!token) this.context.throw("Cannot execute an undefined token");
        if (this.options.debug) console.log("Command: " + token.type);

        this.context.scope.token = token;
        switch (token.type) {
            case "program": {
                const programToken = token as Program;
                let result: Variable | undefined;
                for (const command of programToken.commands) {
                    result = await this.execute(command);
                    if (!this.context.scope.isRunning) break;
                }
                return result;
            }
            case "signal": {
                const signalToken = token as Signal;
                this.context.signal(signalToken.message);
                break;
            }
            case "print": {
                const printToken = token as Print;
                let m = printToken.message;
                if (m.includes("%s")) {
                    for (const arg of printToken.args) {
                        const v = await this.execute(arg);
                        if (!v) return this.context.throw(`Arguments expressions must return a value`);
                        m = m.replace("%s", getVarString(v));
                        if (!m.includes("%s")) break;
                    }
                }
                console.log(m);
                break;
            }
            case "return": {
                const returnToken = token as ReturnCommand;
                this.context.scope.return = true;
                this.context.scope.isRunning = false;
                for (let s: Scope = this.context.scope; s.higherScope && s.type != ScopeType.CLOSURE && s.type != ScopeType.GLOBAL; s = s.higherScope) {
                    s.higherScope.return = true;
                    s.higherScope.isRunning = false;
                }
                const result = await this.execute(returnToken.expr);
                if (!result) return;
                if (this.context.scope.type == ScopeType.GLOBAL) {
                    if (result.type == Type.STRING) {
                        result.value = await this.loadImage(result.value);
                        result.type = Type.IMAGE;
                    }
                }
                return result;
            }
            case "const": {
                const constToken = token as DeclConst;
                const result = await this.execute(constToken.init);
                if (!result) return this.context.throw(`Assignment expression must return a value`);
                this.context.scope.state.addVariable(constToken.id, result.value, result.type, true, this.context);
                break;
            }
            case "var": {
                const varToken = token as DeclVar;
                if (varToken.init) {
                    const result = await this.execute(varToken.init);
                    if (!result) return this.context.throw(`Assignment expression must return a value`);
                    this.context.scope.state.addVariable(varToken.id, result.value, result.type, false, this.context);
                }
                else {
                    this.context.scope.state.addVariable(varToken.id, null, null, false, this.context);
                }
                break;
            }
            case "assignment": {
                const assignmentToken = token as Assignment;
                const result = await this.execute(assignmentToken.init);
                if (!result) return this.context.throw(`Assignment expression must return a value`);

                const state = this.context.scope.state;
                if (!assignmentToken.range) {
                    state.setVariable(assignmentToken.dstId, result.value, result.type, this.context);
                    break;
                }
                //ranged assignment
                const dstVariable = state.getVariable(assignmentToken.dstId, this.context);
                if (dstVariable.type == null) return this.context.throw("Cannot use ranged assignment on an uninitialized variable");
                if (!state.isAssignableTo(dstVariable.type, Type.IMAGE)) this.context.throw("Cannot use ranged assignment with non image variables");

                const [values, types] = await this.executeExprs(assignmentToken.range);
                for (const i in [0, 1, 2, 3]) {
                    if (types[i] != Type.NUMBER) this.context.throw("Invalid type for range expression");
                    if (values[i] % 1 != 0) this.context.throw("Range bounds must be integers");
                }
                if (types.length > 4 && types[4] != Type.STRING) this.context.throw("Invalid type for range expression");

                if (!state.isAssignableTo(result.type, Type.IMAGE)) this.context.throw(`Cannot assign "${getTypeName(result.type)}" to a ranged assignment`);
                if (result.type == Type.EMPTY) this.context.throw("Cannot assign \"empty\" to a ranged assignment");
                if (result.type == Type.STRING) {
                    result.value = await this.loadImage(result.value);
                }
                const range = {
                    from: {
                        x: values[0],
                        y: values[1]
                    }, to: {
                        x: values[2],
                        y: values[3]
                    }
                } as Range;

                if (dstVariable.type == Type.EMPTY) {

                }
                else {
                    result.value = await this.copyImageToImageRange(result.value, range, (dstVariable as { value: Image }).value, values[4]);
                    state.setVariable(assignmentToken.dstId, result.value, Type.IMAGE, this.context);
                }
                break;
            }
            case "call": {
                const callToken = token as Call;
                const [args, types] = await this.executeExprs(callToken.args);
                const f = this.context.scope.environment.lookupFunction(callToken.id);
                if (f === undefined) this.context.throw(`Function ${callToken.id} not found`);
                if (f.builtin) {
                    if (types.find((v, i) => v != f.types[i])) {
                        const toResolve: string[] = [];
                        for (const i in types) if (types[i] == Type.STRING) {
                            types[i] = Type.IMAGE;
                            toResolve.push(i);
                            if (f.types == types) break;
                        }
                        if (types.find((v, i) => v != f.types[i])) this.context.throw(`Cannot call function ${callToken.id} for types ${types.map(getTypeName)}`);
                        for (const i of toResolve) {
                            args[i] = await this.loadImage(args[i]);
                        }
                    }
                    return {
                        type: f.returnType,
                        value: f.handle(args)
                    };
                }

                return await this.executeCommands(ScopeType.CLOSURE, f.commands, callToken.id, async state => {
                    for (const i in f.args) {
                        state.replaceVariable(f.args[i], args[i], types[i], false, this.context);
                    }
                });
            }
            case "while": {
                const whileToken = token as WhileLike;
                let condition = await this.execute(whileToken.condition);
                if (!condition) return this.context.throw("The condition of a while-statement must return a value");
                if (condition.type != Type.BOOLEAN) this.context.throw(`Value of type ${getTypeName(condition.type)} cannot be casted to boolean`);

                while (condition.value) {
                    let result = await this.executeCommands(ScopeType.LOOP, whileToken.commands, "while");
                    if (this.context.scope.return) return result;
                    if (this.context.scope.break) break;

                    condition = await this.execute(whileToken.condition);
                    if (!condition) return this.context.throw("The condition of a while-statement must return a value");
                    if (condition.type != Type.BOOLEAN) this.context.throw(`Value of type ${getTypeName(condition.type)} cannot be casted to boolean`);
                }
                this.context.scope.break = undefined;
                break;
            }
            case "loopFlowCommand": {
                switch ((token as LoopCommand).kind) {
                    case "continue": {
                        if (this.context.scope.type != ScopeType.LOOP) this.context.throw("Cannot continue outside a loop");
                        this.context.scope.isRunning = false;
                        break;
                    }
                    case "break": {
                        if (this.context.scope.type != ScopeType.LOOP) this.context.throw("Cannot break outside a loop");
                        this.context.scope.isRunning = false;
                        this.context.scope.higherScope!.break = true;
                        break;
                    }
                }
            }
            case "if": {
                const ifToken = token as IfLike;
                let result = await this.execute(ifToken.condition);
                if (!result) return this.context.throw("The condition of a if-statement must return a value");
                if (result.type != Type.BOOLEAN) this.context.throw(`Value of type ${getTypeName(result.type)} cannot be casted to boolean`);
                if (result.value) {
                    result = await this.executeCommands(ScopeType.PLAIN, ifToken.commands, "then");
                }
                else if (ifToken.elseCommands) {
                    result = await this.executeCommands(ScopeType.PLAIN, ifToken.elseCommands, "else");
                }
                return result;
            }
            case "closure": {
                const closureToken = token as Closure;
                return await this.executeCommands(ScopeType.CLOSURE, closureToken.commands, "closure");
            }
            case "function": {
                const functionToken = token as Function;
                this.context.scope.environment.bindFunctions(functionToken.id, {
                    builtin: false,
                    args: functionToken.args,
                    commands: functionToken.commands
                }, this.context);
                break;
            }
            case "expr":
                switch ((token as Expr).exprType) {
                    case "boolean":
                        return {
                            value: (token as ValueExpr).value ? true : false,
                            type: Type.BOOLEAN
                        };
                    case "string":
                        return {
                            value: (token as ValueExpr).value,
                            type: Type.STRING
                        };
                    case "number":
                        return {
                            value: Number((token as ValueExpr).value),
                            type: Type.NUMBER
                        };
                    case "id": {
                        const variable = this.context.scope.state.getVariable((token as IdExpr).id, this.context);
                        if (variable.type === null) return this.context.throw(`Variable ${variable.name} has not been initialized yet`);
                        return { value: null, ...variable };
                    }
                    case "call": {
                        const callToken = token as CallExpr;
                        const [args, types] = await this.executeExprs(callToken.args);
                        const f = this.context.scope.environment.lookupFunction(callToken.functionId);
                        if (f === undefined) this.context.throw(`Function ${callToken.functionId} not found`);
                        if (f.builtin) {
                            if (types.find((v, i) => v != f.types[i])) {
                                const toResolve: string[] = [];
                                for (const i in types) if (types[i] == Type.STRING) {
                                    types[i] = Type.IMAGE;
                                    toResolve.push(i);
                                    if (f.types == types) break;
                                }
                                if (types.find((v, i) => v != f.types[i])) this.context.throw(`Cannot call function ${callToken.functionId} for types ${types.map(getTypeName)}`);
                                for (const i of toResolve) {
                                    args[i] = await this.loadImage(args[i]);
                                }
                            }
                            return {
                                type: f.returnType,
                                value: f.handle(args)
                            };
                        }

                        const result = await this.executeCommands(ScopeType.CLOSURE, f.commands, callToken.functionId, async state => {
                            for (const i in f.args) {
                                state.replaceVariable(f.args[i], args[i], types[i], false, this.context);
                            }
                        });
                        if (result === null) this.context.throw(`Missing return statement after executing function ${callToken.functionId}`);
                        return result;
                    }
                    case "closure": {
                        const closureToken = token as ClosureExpr;
                        return await this.executeCommands(ScopeType.CLOSURE, closureToken.commands, "closure");
                    }
                    case "operation": {
                        const operationToken = token as OperationExpr;
                        const [args, types] = await this.executeExprs(operationToken.exprs);
                        var o = this.context.scope.environment.lookupOperation(operationToken.op, types);
                        //try to resolve strings to images to find a matching operator
                        if (o == null) {
                            const toResolve: string[] = [];
                            for (const i in types) if (types[i] == Type.STRING) {
                                types[i] = Type.IMAGE;
                                toResolve.push(i);
                                o = this.context.scope.environment.lookupOperation(operationToken.op, types);
                                if (o != null) break;
                            }
                            if (o == null) this.context.throw(`Unknown operation ${operationToken.op} for types ${types.map(getTypeName)}`);
                            for (const i of toResolve) {
                                args[i] = await this.loadImage(args[i]);
                            }
                        }
                        return {
                            value: await o.operation(args),
                            type: o.outputType
                        };
                    }
                    default:
                        this.context.throw(`Unknown expr token '${(token as Expr).exprType}'`);
                        break;
                }
            default:
                this.context.throw(`Unknown command token '${token.type}'`);
        }
    }

    async executeCommands(scopeType: ScopeType, commands: Command[], name: string, initState = async (_: State) => { }) {
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

    async executeExprs(exprs: Expr[]): Promise<[any[], Type[]]> {
        const args: any[] = [];
        const types: Type[] = [];
        for (const expr of exprs) {
            const result = await this.execute(expr);
            if (!result) return this.context.throw(`Expression does not return a value`);
            args.push(result.value);
            types.push(result.type);
        }
        return [args, types];
    }

    async createBlankImage(width: number, height: number, color: ColorLike = "#00000000"): Promise<Image> {
        if (width <= 0 || height <= 0) this.context.throw("Result image is empty");
        return await sharp({
            create: {
                width,
                height,
                channels: 4,
                background: color
            }
        }).raw().toBuffer({ resolveWithObject: true });
    }

    async loadImage(pathname: string): Promise<Image> {
        try {
            return await sharp(this.options.path + pathname)
                .raw()
                .toBuffer({ resolveWithObject: true });
        }
        catch (err) {
            return this.context.throw((err as Error).message);
        }
    }

    async copyImage(image: Image): Promise<Image> {
        const { width, height } = image.info;
        return await sharp(image.data.buffer, { raw: { width, height, channels: image.info.channels } }).raw().toBuffer({ resolveWithObject: true });
    }

    async copyImageToImageRange(srcImage: Image, dstRange: Range, dstImage: Image, color: ColorLike = "#00000000"): Promise<Image> {
        const { width: w0, height: h0 } = srcImage.info;
        const { width: w1, height: h1 } = dstImage.info;
        const w2 = dstRange.to.x - dstRange.from.x;
        const h2 = dstRange.to.y - dstRange.from.y;

        if (isRangeEmpty(dstRange)) return dstImage;

        return await sharp(dstImage.data.buffer, { raw: { width: w1, height: h1, channels: dstImage.info.channels } })
            .extend({
                left: Math.max(-dstRange.from.x, 0),
                top: Math.max(-dstRange.from.y, 0),
                right: Math.max(dstRange.to.x - w1, 0),
                bottom: Math.max(dstRange.to.y - h1, 0),
                background: color
            })
            .composite([{
                input: await sharp(srcImage.data.buffer, { raw: { width: w0, height: h0, channels: srcImage.info.channels } })
                    .resize(w2, h2)
                    .raw()
                    .toBuffer(),
                raw: { width: w2, height: h2, channels: srcImage.info.channels },
                blend: "over",
                top: Math.max(dstRange.from.y, 0),
                left: Math.max(dstRange.from.x, 0)
            }])
            .raw()
            .toBuffer({ resolveWithObject: true });
    }

    async applyElementWiseOperation(op: (c0: number, c1: number) => number, opName: string, args: Image[]): Promise<Image> {

        switch (args.length) {
            case 1: {
                const value = args[0];
                const { width, height, channels } = value.info;
                const { data, info } = await this.createBlankImage(width, height);
                const valueTexture = new Uint8ClampedArray(value.data.buffer);
                const texture = new Uint8ClampedArray(data.buffer);
                for (let i = 0; i < width * height * channels; i++) {
                    texture[i] = op(valueTexture[i] / 255, 0) * 255;
                }

                return { data, info };
            }
            case 2: {
                const left = args[0];
                const right = args[1];
                if (right.info.width != left.info.width || right.info.height != left.info.height) {
                    this.context.throw(`Incompatible sizes for operation '${opName}': ${right.info.width}x${right.info.height} and ${left.info.width}x${left.info.height}`);
                }
                if (right.info.channels != left.info.channels) {
                    this.context.throw(`Incompatible formats for operation '${opName}': ${right.info.channels} and ${left.info.channels}`);
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
                return this.context.throw("Unsupported operation");
        }
    }

    async applyBlending(image0: Image, image1: Image): Promise<Image> {
        const w0 = image0.info.width;
        const h0 = image0.info.height;
        let w1 = image1.info.width;
        let h1 = image1.info.height;
        if (w0 < w1 || h0 < h1) {
            image1 = await this.applyRange(image1, { from: { x: 0, y: 0 }, to: { x: w0, y: h0 } });
            w1 = image1.info.width;
            h1 = image1.info.height;
        }
        return await sharp(image0.data.buffer, { raw: { width: w0, height: h0, channels: image0.info.channels } })
            .composite([{
                input: image1.data.buffer as any,
                raw: { width: w1, height: h1, channels: image1.info.channels },
                blend: "over",
                top: Math.max(h1 - h0, 0),
                left: Math.max(w1 - w0, 0)
            }])
            .raw()
            .toBuffer({ resolveWithObject: true });
    }

    async applyRotation(image: Image, angle: number, color: ColorLike = "#00000000"): Promise<Image> {
        return await sharp(image.data.buffer, { raw: { width: image.info.width, height: image.info.height, channels: image.info.channels } })
            .rotate(angle * this.options.angleUnit / Math.PI * 180, { background: color })
            .raw()
            .toBuffer({ resolveWithObject: true });
    }

    async applyReflect(image: Image, angle: number): Promise<Image> {
        angle *= this.options.angleUnit;
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return await sharp(image.data.buffer, { raw: { width: image.info.width, height: image.info.height, channels: image.info.channels } })
            .affine([c, -s, s, c])
            .raw()
            .toBuffer({ resolveWithObject: true });
    }

    async applyFlop(image: Image): Promise<Image> {
        return await sharp(image.data.buffer, { raw: { width: image.info.width, height: image.info.height, channels: image.info.channels } })
            .flop()
            .raw()
            .toBuffer({ resolveWithObject: true });
    }

    async applySharpen(image: Image): Promise<Image> {
        return await sharp(image.data.buffer, { raw: { width: image.info.width, height: image.info.height, channels: image.info.channels } })
            .sharpen()
            .raw()
            .toBuffer({ resolveWithObject: true });
    }

    async applyConcat(image0: Image, image1: Image, xRelative: -1 | 0 | 1, yRelative: -1 | 0 | 1, backgroundColor: ColorLike = "#00000000"): Promise<Image> {

        if (xRelative == 0 && yRelative == 0) return await this.applyBlending(image0, image1);

        const w0 = image0.info.width;
        const h0 = image0.info.height;
        const w1 = image1.info.width;
        const h1 = image1.info.height;

        return await sharp(image0.data.buffer, { raw: { width: w0, height: h0, channels: image0.info.channels } })
            .extend({
                left: xRelative == -1 ? w1 : 0,
                top: yRelative == -1 ? h1 : 0,
                right: xRelative == 1 ? w1 : 0,
                bottom: yRelative == 1 ? h1 : 0,
                background: backgroundColor
            })
            .composite([{
                input: image1.data.buffer as any,
                raw: { width: w1, height: h1, channels: image1.info.channels },
                blend: "over",
                left: xRelative > 0 ? w0 : 0,
                top: yRelative > 0 ? h0 : 0,
            }])
            .raw()
            .toBuffer({ resolveWithObject: true });
    }

    async applyRange(image: Image, range: Range, backgroundColor: ColorLike = "#00000000"): Promise<Image> {
        const w = image.info.width;
        const h = image.info.height;

        if (isRangeEmpty(range)) this.context.throw("Range is empty");

        const leftGrow = range.from.x < 0;
        const rightGrow = range.to.x > w;
        const topGrow = range.from.y < 0;
        const bottomGrow = range.to.y > h;

        const leftShrink = range.to.x < w;
        const rightShrink = range.from.x > 0;
        const topShrink = range.to.y < h;
        const bottomShrink = range.from.y > 0;

        const grow = leftGrow || rightGrow || topGrow || bottomGrow;
        const shrink = leftShrink || rightShrink || topShrink || bottomShrink;

        if (!grow && !shrink) return image;

        const s = sharp(image.data.buffer, { raw: { width: w, height: h, channels: image.info.channels } });
        if (shrink) {
            s.extract({
                left: Math.max(range.from.x, 0),
                top: Math.max(range.from.y, 0),
                width: Math.min(range.to.x, w) - Math.max(range.from.x, 0),
                height: Math.min(range.to.y, h) - Math.max(range.from.y, 0)
            });
        }
        if (grow) {
            s.extend({
                left: Math.max(-range.from.x, 0),
                top: Math.max(-range.from.y, 0),
                right: Math.max(range.to.x - w, 0),
                bottom: Math.max(range.to.y - h, 0),
                background: backgroundColor
            });
        }

        return await s
            .raw()
            .toBuffer({ resolveWithObject: true });
    }

    async applyResize(image: Image, width: number, height: number, kernel: string): Promise<Image> {
        if (kernel && ["nearest", "linear", "cubic", "mitchell", "lanczos2", "lanczos3", "mks2013", "mks2021"].indexOf(kernel) == -1) {
            this.context.throw(`Unknown resize kernel "${kernel}"`);
        }
        if (width <= 0 || height <= 0) {
            this.context.throw("Cannot resize image to a zero-sized image");
        }
        return await sharp(image.data.buffer, { raw: { width: image.info.width, height: image.info.height, channels: image.info.channels } })
            .resize({
                fit: "fill",
                width,
                height,
                kernel: kernel as any
            })
            .raw()
            .toBuffer({ resolveWithObject: true });
    }
}

async function printAst(properties: Properties, syntaxFileName: string, codeFileName: string) {

    try {
        console.log("Reading syntax...");
        const grammar = await readFile(syntaxFileName, "utf-8");
        const parser = new Parser(Grammars.Custom.getRules(grammar), {});
        console.log(`Reading program "${codeFileName}"...`);
        const program = await readFile(codeFileName, "utf-8");

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

async function runFile(properties: Properties, syntaxFileName: string, codeFileName: string) {
    try {
        console.log("Reading syntax...");
        const grammar = await readFile(syntaxFileName, "utf-8");
        const parser = new Parser(Grammars.Custom.getRules(grammar), {});
        console.log(`Reading program "${codeFileName}"...`);
        const program = await readFile(codeFileName, "utf-8");

        const parseTree = parser.getAST(program);

        if (!parseTree) {
            throw "Failed to parse file";
        }
        const ast = buildAst(parseTree);

        if (!ast) {
            console.log("Failed to generate AST");
            return;
        }

        console.log("Executing...");

        const engine = new Engine({
            path: properties.imagesPath ?? "examples/simple/images",
            debug: properties.debug ? true : false,
            angleUnit: units[properties.angleUnit ?? ""]
        });

        const result = await engine.execute(ast as Token);
        if (!result) {
            console.log("No results");
            return;
        }
        if (result.type == Type.IMAGE) {
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

async function repl(properties: Properties, syntaxFileName: string) {
    const grammar = await readFile(syntaxFileName, "utf-8");
    const parser = new Parser(Grammars.Custom.getRules(grammar), {});

    const engine = new Engine({
        path: properties.imagesPath ?? "examples/simple/images",
        debug: properties.debug ? true : false,
        angleUnit: units[properties.angleUnit ?? ""]
    });

    var rl = await import("readline-sync");
    while (true) {
        var line = rl.question("> ");
        if (line == "exit" || line == "stop") {
            return;
        }
        if (line == "clear") {
            console.log("\x1B[2J\x1B[H");
            continue;
        }
        let parseTree = parser.getAST(line);
        if (!parseTree && !line.endsWith(";")) parseTree = parser.getAST(line + ";");
        if (!parseTree) {
            console.log("Failed to parse line");
            return;
        }
        try {
            const ast = buildAst(parseTree, true);
            if (!ast) {
                console.log("Failed to generate AST");
                return;
            }
            const result = await engine.execute(ast as Token);
            if (result) {
                if (result.type == Type.IMAGE) {
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

const units: {
    [key: string]: number | undefined;
} = {
    degree: Math.PI / 180,
    radians: 1,
    turns: 2 * Math.PI,
};

const properties: Properties = {};

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

async function main() {

    if (properties.debug) {
        console.log("Properties", properties);
    }

    properties.mode = properties.mode?.toLowerCase() ?? "run";

    if (properties.help !== undefined) {
        console.log("Usage: ");
        console.log("Properties:");
        for (const e of [
            { name: "test", desc: "Specify test files as input file", usage: "<test_id>" },
            { name: "example", desc: "Specify example files as input file", usage: "<example_id>" },
            { name: "input", desc: "Specify the input file path", usage: "<path_of_file>" },
            { name: "syntax", desc: "Specify the syntax file path", usage: "<path_of_file>" },
            { name: "mode", desc: "Specify the run mode (default: run), when in \"run\" execute the given input, when in \"repl\" starts a REPL environment, when in \"ast\" parses and prints the input's ast tree and return", usage: "{ run | repl | ast }" },
            { name: "imagesPath", desc: "Specify the root directory where images are resolved to", usage: "<path_of_directory>" },
            { name: "angleUnit", desc: "Specify the value of an angle of 1", usage: "{ degree | radians | turns }" },
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

        if ((properties.test ? 1 : 0) + (properties.example ? 1 : 0) + (properties.input ? 1 : 0) > 1) {
            console.log("Only one input must be specified");
            return;
        }
        if (properties.test) codeFilename = "examples/simple/test" + properties.test + ".tpl";
        else if (properties.input) codeFilename = properties.input;
        else if (properties.example) codeFilename = "examples/simple/example" + properties.example + ".tpl";
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
}
await main();