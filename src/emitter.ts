import * as ts from 'typescript';
import { IdentifierResolver } from './resolvers';
import { Helpers } from './helpers';
import { Preprocessor } from './preprocessor';
import { CodeWriter } from './codewriter';

class ReturnStatement {

    returnStatement: ts.ReturnStatement;

    constructor(s:ts.ReturnStatement) {
        this.returnStatement = s;
    }
    hasValue():boolean {
        return !!this.returnStatement.expression;
    }
}

interface EmitFiles {
    rootFolder: string;
    fileNameHeader:string;
    fileNameHeader_pre:string;
    fileNameCpp:string;
}

type HasTemplate0 = ts.MethodDeclaration | ts.ConstructorDeclaration | ts.FunctionDeclaration;
type HasTemplate1 = HasTemplate0 | ts.ClassDeclaration | ts.FunctionExpression;
type HasTemplate = HasTemplate0 | ts.FunctionExpression | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration | 
    ts.TypeAliasDeclaration | ts.ArrowFunction | ts.MethodSignature;

type FuncExpr = ts.FunctionExpression | ts.ArrowFunction | ts.FunctionDeclaration | ts.MethodDeclaration
            | ts.ConstructorDeclaration | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration;

export class Emitter {
    public writer: CodeWriter;
    public writer_predecl: CodeWriter;
    private resolver: IdentifierResolver;
    private preprocessor: Preprocessor;
    private typeChecker: ts.TypeChecker;
    private sourceFile: ts.SourceFile;
    private sourceFileName: string;
    private scope: Array<ts.Node> = new Array<ts.Node>();
    private opsMap: Map<number, string> = new Map<number, string>();
    private embeddedCPPTypes: Array<string>;
    private isWritingMain = false;

    public constructor(
        typeChecker: ts.TypeChecker, private options: ts.CompilerOptions,
        private cmdLineOptions: any, private singleModule: boolean,
        private emitFiles:EmitFiles) {

        this.writer = new CodeWriter();
        this.writer_predecl = new CodeWriter();
        this.typeChecker = typeChecker;
        this.resolver = new IdentifierResolver(typeChecker);
        this.preprocessor = new Preprocessor(this.resolver, this);

        this.opsMap[ts.SyntaxKind.EqualsToken] = '=';
        this.opsMap[ts.SyntaxKind.PlusToken] = '+';
        this.opsMap[ts.SyntaxKind.MinusToken] = '-';
        this.opsMap[ts.SyntaxKind.AsteriskToken] = '*';
        this.opsMap[ts.SyntaxKind.PercentToken] = '%';
        this.opsMap[ts.SyntaxKind.AsteriskAsteriskToken] = '__Math.pow';
        this.opsMap[ts.SyntaxKind.SlashToken] = '/';
        this.opsMap[ts.SyntaxKind.AmpersandToken] = '__std::bit_and()';
        this.opsMap[ts.SyntaxKind.BarToken] = '__std::bit_or()';
        this.opsMap[ts.SyntaxKind.CaretToken] = '__std::bit_xor()';
        this.opsMap[ts.SyntaxKind.LessThanLessThanToken] = '__bitwise::lshift';
        this.opsMap[ts.SyntaxKind.GreaterThanGreaterThanToken] = '__bitwise::rshift';
        this.opsMap[ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken] = '__bitwise::rshift_nosign';
        this.opsMap[ts.SyntaxKind.EqualsEqualsToken] = '__equals';
        this.opsMap[ts.SyntaxKind.EqualsEqualsEqualsToken] = '==';
        this.opsMap[ts.SyntaxKind.LessThanToken] = '<';
        this.opsMap[ts.SyntaxKind.LessThanEqualsToken] = '<=';
        this.opsMap[ts.SyntaxKind.ExclamationEqualsToken] = '__not_equals';
        this.opsMap[ts.SyntaxKind.ExclamationEqualsEqualsToken] = '!=';
        this.opsMap[ts.SyntaxKind.GreaterThanToken] = '>';
        this.opsMap[ts.SyntaxKind.GreaterThanEqualsToken] = '>=';

        this.opsMap[ts.SyntaxKind.PlusEqualsToken] = '+=';
        this.opsMap[ts.SyntaxKind.MinusEqualsToken] = '-=';
        this.opsMap[ts.SyntaxKind.AsteriskEqualsToken] = '*=';
        this.opsMap[ts.SyntaxKind.PercentEqualsToken] = '%=';
        this.opsMap[ts.SyntaxKind.AsteriskAsteriskEqualsToken] = '**=';
        this.opsMap[ts.SyntaxKind.SlashEqualsToken] = '/=';
        this.opsMap[ts.SyntaxKind.AmpersandEqualsToken] = '&=';
        this.opsMap[ts.SyntaxKind.BarEqualsToken] = '|=';
        this.opsMap[ts.SyntaxKind.CaretEqualsToken] = '^=';
        this.opsMap[ts.SyntaxKind.LessThanLessThanEqualsToken] = '<<=';
        this.opsMap[ts.SyntaxKind.GreaterThanGreaterThanEqualsToken] = '>>=';
        this.opsMap[ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken] = '__StrictNotEqualsAssign';

        this.opsMap[ts.SyntaxKind.TildeToken] = '__std::bit_not()';
        this.opsMap[ts.SyntaxKind.ExclamationToken] = '!';
        this.opsMap[ts.SyntaxKind.PlusPlusToken] = '++';
        this.opsMap[ts.SyntaxKind.MinusMinusToken] = '--';
        this.opsMap[ts.SyntaxKind.InKeyword] = '__in';

        this.opsMap[ts.SyntaxKind.AmpersandAmpersandToken] = '__AND';
        this.opsMap[ts.SyntaxKind.BarBarToken] = '__OR';

        this.opsMap[ts.SyntaxKind.CommaToken] = ',';

        // embedded types
        this.embeddedCPPTypes = [
            'bool',
            'char',
            'signed char',
            'unsigned char',
            'short',
            'short int',
            'signed short',
            'signed short int',
            'unsigned short',
            'unsigned short int',
            'int',
            'signed',
            'signed int',
            'unsigned',
            'unsigned int',
            'long',
            'long int',
            'signed long',
            'signed long int',
            'unsigned long',
            'unsigned long int',
            'long long',
            'long long int',
            'signed long long',
            'signed long long int',
            'unsigned long long',
            'unsigned long long int',
            'float',
            'double',
            'long double',
            'int8_t',
            'int16_t',
            'int32_t',
            'int64_t',
            'int_fast8_t',
            'int_fast16_t',
            'int_fast32_t',
            'int_fast64_t',
            'int_least8_t',
            'int_least16_t',
            'int_least32_t',
            'int_least64_t',
            'intmax_t',
            'intptr_t',
            'uint8_t',
            'uint16_t',
            'uint32_t',
            'uint64_t',
            'uint_fast8_t',
            'uint_fast16_t',
            'uint_fast32_t',
            'uint_fast64_t',
            'uint_least8_t',
            'uint_least16_t',
            'uint_least32_t',
            'uint_least64_t',
            'uintmax_t',
            'uintptr_t',
            'wchar_t',
            'char16_t',
            'char32_t',
            'char8_t'
        ];
    }

    public HeaderMode: boolean;
    public SourceMode: boolean;

    public isHeader() {
        return this.HeaderMode;
    }

    public isSource() {
        return this.SourceMode;
    }

    public isHeaderWithSource() {
        return (this.HeaderMode && this.SourceMode) || (!this.HeaderMode && !this.SourceMode);
    }

    public get isGlobalScope() {
        return this.scope.length > 0 && this.scope[this.scope.length - 1].kind === ts.SyntaxKind.SourceFile;
    }

    public printNode(node: ts.Statement): string {
        const sourceFile = ts.createSourceFile(
            'noname', '', ts.ScriptTarget.ES2018, /*setParentNodes */ true, ts.ScriptKind.TS);

        (<any>sourceFile.statements) = [node];

        // debug output
        const emitter = ts.createPrinter({
            newLine: ts.NewLineKind.LineFeed,
        });

        const result = emitter.printNode(ts.EmitHint.SourceFile, sourceFile, sourceFile);
        return result;
    }

    public processNode(node: ts.Node): void {
        switch (node.kind) {
            case ts.SyntaxKind.SourceFile:
                this.processFile(<ts.SourceFile>node);
                break;
            case ts.SyntaxKind.Bundle:
                this.processBundle(<ts.Bundle>node);
                break;
            case ts.SyntaxKind.UnparsedSource:
                this.processUnparsedSource(<ts.UnparsedSource>node);
                break;
            default:
                // TODO: finish it
                throw new Error('Method not implemented.');
        }
    }

    private isImportStatement(f: ts.Statement | ts.Declaration): boolean {
        if (f.kind === ts.SyntaxKind.ImportDeclaration
            || f.kind === ts.SyntaxKind.ImportEqualsDeclaration
            || f.kind === ts.SyntaxKind.ExportDeclaration) {
            return true;
        }

        return false;
    }

    private isDeclarationStatement(f: ts.Statement | ts.Declaration): boolean {
        if (f.kind === ts.SyntaxKind.FunctionDeclaration
            || f.kind === ts.SyntaxKind.EnumDeclaration
            || f.kind === ts.SyntaxKind.ClassDeclaration
            || f.kind === ts.SyntaxKind.InterfaceDeclaration
            || f.kind === ts.SyntaxKind.ModuleDeclaration
            || f.kind === ts.SyntaxKind.NamespaceExportDeclaration
            || f.kind === ts.SyntaxKind.TypeAliasDeclaration) {
            return true;
        }

        return false;
    }

    private isVariableStatement(f: ts.Node): boolean {
        if (f.kind === ts.SyntaxKind.VariableStatement) {
            return true;
        }

        return false;
    }

    private isNamespaceStatement(f: ts.Node): boolean {
        if (f.kind === ts.SyntaxKind.ModuleDeclaration
            || f.kind === ts.SyntaxKind.NamespaceExportDeclaration) {
            return true;
        }

        return false;
    }

    private childrenVisitorNoScope(location: ts.Node, visit: (node: ts.Node) => boolean) {
        function checkChild(node: ts.Node): any {
            if (!visit(node)) {
                ts.forEachChild(node, checkChild);
            }
        }

        ts.forEachChild(location, checkChild);
    }

    private childrenVisitor(location: ts.Node, visit: (node: ts.Node) => boolean) {
        let root = true;
        function checkChild(node: ts.Node): any {
            if (root) {
                root = false;
            } else {
                if (node.kind === ts.SyntaxKind.FunctionDeclaration
                    || node.kind === ts.SyntaxKind.ArrowFunction
                    || node.kind === ts.SyntaxKind.MethodDeclaration
                    || node.kind === ts.SyntaxKind.FunctionExpression
                    || node.kind === ts.SyntaxKind.FunctionType
                    || node.kind === ts.SyntaxKind.ConstructorType
                    
                    || node.kind === ts.SyntaxKind.ClassDeclaration
                    || node.kind === ts.SyntaxKind.ClassExpression) {
                    return;
                }
            }

            if (!visit(node)) {
                ts.forEachChild(node, checkChild);
            }
        }

        ts.forEachChild(location, checkChild);
    }

    extractReturnInfo(location: ts.Node): ReturnStatement {
        let hasReturnResult:ReturnStatement = null;
        this.childrenVisitor(location, (node: ts.Node) => {
            if (node.kind === ts.SyntaxKind.ReturnStatement) {
                const returnStatement = <ts.ReturnStatement>node;
                hasReturnResult = new ReturnStatement(returnStatement);
                if (hasReturnResult.hasValue()) {
                    return true;
                }
            }

            return false;
        });

        return hasReturnResult;
    }

    private hasPropertyAccess(location: ts.Node, property: string): boolean {
        let hasPropertyAccessResult = false;
        this.childrenVisitor(location, (node: ts.Node) => {
            if (node.kind === ts.SyntaxKind.Identifier && node.parent.kind === ts.SyntaxKind.PropertyAccessExpression) {
                const identifier = <ts.Identifier>node;
                if (identifier.text === property) {
                    hasPropertyAccessResult = true;
                    return true;
                }
            }

            return false;
        });

        return hasPropertyAccessResult;
    }

    private hasArguments(location: ts.Node): boolean {
        let hasArgumentsResult = false;
        this.childrenVisitor(location, (node: ts.Node) => {
            if (node.kind === ts.SyntaxKind.Identifier && node.parent.kind !== ts.SyntaxKind.PropertyAccessExpression) {
                const identifier = <ts.Identifier>node;
                if (identifier.text === 'arguments') {
                    hasArgumentsResult = true;
                    return true;
                }
            }

            return false;
        });

        return hasArgumentsResult;
    }

    private requireCapture(location: ts.Node): boolean {
        let requireCaptureResult = false;
        this.childrenVisitor(location, (node: ts.Node) => {
            if (node.kind === ts.SyntaxKind.Identifier
                && node.parent.kind !== ts.SyntaxKind.FunctionDeclaration
                && node.parent.kind !== ts.SyntaxKind.ClassDeclaration
                && node.parent.kind !== ts.SyntaxKind.MethodDeclaration
                && node.parent.kind !== ts.SyntaxKind.EnumDeclaration) {
                const data = this.resolver.isLocal(node);
                if (data) {
                    const isLocal = data[0];
                    if (isLocal !== undefined && !isLocal) {
                        requireCaptureResult = true;
                        return true;
                    }
                }
            }

            return false;
        });

        return requireCaptureResult;
    }

    private markRequiredCapture(location: ts.Node): void {
        this.childrenVisitorNoScope(location, (node: ts.Node) => {
            if (node.kind === ts.SyntaxKind.Identifier
                && node.parent.kind !== ts.SyntaxKind.FunctionDeclaration
                && node.parent.kind !== ts.SyntaxKind.ClassDeclaration
                && node.parent.kind !== ts.SyntaxKind.MethodDeclaration
                && node.parent.kind !== ts.SyntaxKind.EnumDeclaration) {
                const data = this.resolver.isLocal(node);
                if (data) {
                    const isLocal = data[0];
                    const resolvedSymbol = data[1];
                    if (isLocal !== undefined && !isLocal) {
                        (<any>resolvedSymbol).valueDeclaration.__requireCapture = true;
                    }
                }
            }

            return false;
        });
    }

    private hasThis(location: ts.Node): boolean {
        let createThis = false;
        this.childrenVisitor(location, (node: ts.Node) => {
            if (node.kind === ts.SyntaxKind.ThisKeyword) {
                createThis = true;
                return true;
            }

            return false;
        });

        return createThis;
    }

    private hasThisAsShared(location: ts.Node): boolean {
        let createThis = false;
        this.childrenVisitor(location, (node: ts.Node) => {
            if (node.kind === ts.SyntaxKind.ThisKeyword && node.parent.kind !== ts.SyntaxKind.PropertyAccessExpression) {
                createThis = true;
                return true;
            }

            return false;
        });

        return createThis;
    }

    private processFile(sourceFile: ts.SourceFile): void {
        this.scope.push(sourceFile);
        this.processFileInternal(sourceFile);
        this.scope.pop();
    }

    private processFileInternal(sourceFile: ts.SourceFile): void {
        this.fixupParentReferences(sourceFile);

        this.sourceFile = sourceFile;
        this.sourceFileName = sourceFile.fileName;


        if (this.isHeader()) {

            let ow = this.writer;
            try {
                this.writer = this.writer_predecl;

                this.WriteHeader(true);

                // NOTE Not implemented here:
                // dependency analysis
                // proper way is building a symbol level dependency graph
                // (for my purposes)
                this.processHeaderFileIncludes(sourceFile, true);

                this.processHeaderFilePredecls(sourceFile);

                // end of header
                this.writer.writeStringNewLine(`#endif`);

            } finally {
                this.writer = ow;
            }


            // added header
            this.WriteHeader();

            this.writer.writeStringNewLine('');
            // self predecl first!
            this.writer.writeStringNewLine('#include "'+this.emitFiles.fileNameHeader_pre+'"');
            this.writer.writeStringNewLine('');
            this.processHeaderFileIncludes(sourceFile, false);

            this.writer.writeStringNewLine('');
            this.writer.writeStringNewLine('using namespace js;');
            this.writer.writeStringNewLine('');
    
            let cnt=0;
            sourceFile.statements
                .map(v => this.preprocessor.preprocessStatement(v))
                .filter(s => this.isDeclarationStatement(s) || this.isVariableStatement(s))
                .forEach(s => {
                    if (this.isVariableStatement(s)) {
                        // already done 2)
                        //this.writer.writeStringNewLine("// 3) forward decl "+(cnt++)+":");
                        //this.processForwardDeclaration(s);
                    } else if (s.kind === ts.SyntaxKind.FunctionDeclaration) {
                        // also done 2)
                    } else {
                        //this.writer.writeStringNewLine("// 3) statement "+(cnt++)+":");
                        this.processStatement(s);
                    }
                });

            sourceFile.statements.filter(s => this.isDeclarationStatement(s) || this.isVariableStatement(s)).forEach(s => {
                this.processImplementation(s, true);
            });
        }

        if (this.isSource()) {
            // added header
            this.WriteHeader();

            sourceFile.statements.filter(s => this.isImportStatement(s)).forEach(s => {
                this.processImplementation(s);
            });

            this.writer.writeStringNewLine('');
            this.writer.writeStringNewLine('using namespace js;');
            this.writer.writeStringNewLine('');

            sourceFile.statements.filter(s => this.isDeclarationStatement(s)).forEach(s => {
                this.processImplementation(s);
            });

            const positionBeforeVars = this.writer.newSection();

            sourceFile.statements
                .map(v => this.preprocessor.preprocessStatement(v))
                .filter(s => this.isVariableStatement(s)
                    || this.isNamespaceStatement(s))
                .forEach(s => {
                    if (this.isNamespaceStatement(s)) {
                        this.isWritingMain = true;
                        this.processModuleVariableStatements(<ts.ModuleDeclaration>s);
                        this.isWritingMain = false;
                    } else {
                        this.processStatement(<ts.Statement>s);
                    }
                });

            const hasVarsContent = this.writer.hasAnyContent(positionBeforeVars);

            const rollbackPosition = this.writer.newSection();

            this.writer.writeStringNewLine('');
            this.writer.writeStringNewLine('void Main(void)');
            this.writer.BeginBlock();

            this.isWritingMain = true;

            const position = this.writer.newSection();

            sourceFile.statements.filter(s => !this.isDeclarationStatement(s) && !this.isVariableStatement(s)
                || this.isNamespaceStatement(s)).forEach(s => {
                if (this.isNamespaceStatement(s)) {
                    this.processModuleImplementationInMain(<ts.ModuleDeclaration>s);
                } else {
                    this.processStatement(s);
                }
            });

            this.isWritingMain = false;

            if (hasVarsContent || this.writer.hasAnyContent(position, rollbackPosition)) {
                this.writer.EndBlock();

                this.writer.writeStringNewLine('');
                this.writer.writeStringNewLine('MAIN');
            }
        }

        if (this.isHeader()) {
            // end of header
            this.writer.writeStringNewLine(`#endif`);
        }
    }

    private processHeaderFileIncludes(sourceFile: ts.SourceFile, predecl: boolean): void {
        sourceFile.referencedFiles.forEach(f => {
            this.writer.writeString('#include \"');
            this.writer.writeString(f.fileName.replace('.d.ts', ''));
            if (predecl)
                this.writer.writeString("_pre");
            this.writer.writeStringNewLine('.h\"');
        });

        let cnt=0;
        //sourceFile.statements.filter(s => this.isImportStatement(s)||this.isDeclarationStatement(s)).forEach(s => {
        sourceFile.statements
            .map(v => this.preprocessor.preprocessStatement(v))
            .filter(s => this.isImportStatement(s)||this.isDeclarationStatement(s))
            .forEach(s => {

            let ow = this.writer;
            try {
                this.writer = new CodeWriter();
                this.processInclude(s, predecl);
                if (this.writer.getText()) {
                    //ow.writeStringNewLine("// 1) include "+(cnt++)+":");
                    ow.writeString(this.writer.getText());
                }
            } finally {
                this.writer = ow;
            }
        });
    }

    private processHeaderFilePredecls(sourceFile: ts.SourceFile): void {

        //const position = this.writer.newSection();

        /*cnt=0;
        sourceFile.statements.filter(s => this.isDeclarationStatement(s)).forEach(s => {
            const node = this.preprocessor.preprocessStatement(<ts.Statement>s);
            if (node.kind==ts.SyntaxKind.TypeAliasDeclaration) {
                this.writer.writeStringNewLine("// 2) type alias "+(cnt++)+":");
                this.processTypeAliasDeclaration(<ts.TypeAliasDeclaration>node, false);
            }
        });*/

        let cnt=0;
        //sourceFile.statements.filter(s => this.isDeclarationStatement(s) || this.isVariableStatement(s)).forEach(s => {
        sourceFile.statements
            .map(v => this.preprocessor.preprocessStatement(v))
            .filter(s => this.isDeclarationStatement(s) || this.isVariableStatement(s))
            .forEach(s => {
    
            let ow = this.writer;
            try {
                this.writer = new CodeWriter();
                this.processForwardDeclaration2(s);
                if (s.kind === ts.SyntaxKind.FunctionDeclaration) {
                    //this.writer.writeStringNewLine("// 2) function statement forward decl "+(cnt++)+":");
                    this.processStatement(s);
                }
                if (this.writer.getText()) {
                    //ow.writeStringNewLine("// 2) forward decl "+(cnt++)+":");
                    ow.writeString(this.writer.getText());
                }

            } finally {
                this.writer = ow;
            }

        });


        /*if (this.writer.hasAnyContent(position)) {
            this.writer.writeStringNewLine();
        }*/
    }

    private WriteHeader(predecl = false) {
        const filePath = Helpers.getSubPath(Helpers.cleanUpPath(this.sourceFileName), Helpers.cleanUpPath(this.emitFiles.rootFolder));
        if (this.isSource()) {
            this.writer.writeStringNewLine(`#include "${filePath.replace(/\.ts$/, '.h')}"`);
        } else {
            let headerName = filePath.replace(/\.ts$/, '').replace(/[\\\/\.]/g, '_').toUpperCase();
            if (predecl)
                headerName += "_PRE_H";
            else
                headerName += "_H";
            this.writer.writeStringNewLine(`#ifndef ${headerName}`);
            this.writer.writeStringNewLine(`#define ${headerName}`);

            if (!predecl)
                this.writer.writeStringNewLine(`#include "cpplib/core.h"`);
        }
    }

    private processBundle(bundle: ts.Bundle): void {
        throw new Error('Method not implemented.');
    }

    private processUnparsedSource(unparsedSource: ts.UnparsedSource): void {
        throw new Error('Method not implemented.');
    }

    private processStatement(node: ts.Statement | ts.Declaration): void {
        this.processStatementInternal(node);
    }

    private processStatementInternal(nodeIn: ts.Statement | ts.Declaration, enableTypeAliases = false): void {
        const node = this.preprocessor.preprocessStatement(nodeIn);

        switch (node.kind) {
            case ts.SyntaxKind.EmptyStatement: return;
            case ts.SyntaxKind.VariableStatement: this.processVariableStatement(<ts.VariableStatement>node); return;
            case ts.SyntaxKind.FunctionDeclaration: this.processFunctionDeclaration(<ts.FunctionDeclaration>node); return;
            case ts.SyntaxKind.Block: this.processBlock(<ts.Block>node); return;
            case ts.SyntaxKind.ModuleBlock: this.processModuleBlock(<ts.ModuleBlock>node); return;
            case ts.SyntaxKind.ReturnStatement: this.processReturnStatement(<ts.ReturnStatement>node); return;
            case ts.SyntaxKind.IfStatement: this.processIfStatement(<ts.IfStatement>node); return;
            case ts.SyntaxKind.DoStatement: this.processDoStatement(<ts.DoStatement>node); return;
            case ts.SyntaxKind.WhileStatement: this.processWhileStatement(<ts.WhileStatement>node); return;
            case ts.SyntaxKind.ForStatement: this.processForStatement(<ts.ForStatement>node); return;
            case ts.SyntaxKind.ForInStatement: this.processForInStatement(<ts.ForInStatement>node); return;
            case ts.SyntaxKind.ForOfStatement: this.processForOfStatement(<ts.ForOfStatement>node); return;
            case ts.SyntaxKind.BreakStatement: this.processBreakStatement(<ts.BreakStatement>node); return;
            case ts.SyntaxKind.ContinueStatement: this.processContinueStatement(<ts.ContinueStatement>node); return;
            case ts.SyntaxKind.SwitchStatement: this.processSwitchStatement(<ts.SwitchStatement>node); return;
            case ts.SyntaxKind.ExpressionStatement: this.processExpressionStatement(<ts.ExpressionStatement>node); return;
            case ts.SyntaxKind.TryStatement: this.processTryStatement(<ts.TryStatement>node); return;
            case ts.SyntaxKind.ThrowStatement: this.processThrowStatement(<ts.ThrowStatement>node); return;
            case ts.SyntaxKind.DebuggerStatement: this.processDebuggerStatement(<ts.DebuggerStatement>node); return;
            case ts.SyntaxKind.EnumDeclaration: this.processEnumDeclaration(<ts.EnumDeclaration>node); return;
            case ts.SyntaxKind.ClassDeclaration: this.processClassDeclaration(<ts.ClassDeclaration>node); return;
            case ts.SyntaxKind.InterfaceDeclaration: this.processClassDeclaration(<ts.InterfaceDeclaration>node); return;
            case ts.SyntaxKind.ExportDeclaration: 
                /*done in forward declaration*/ /*this.processExportDeclaration(<ts.ExportDeclaration>node);*/ return;
            case ts.SyntaxKind.ModuleDeclaration: this.processModuleDeclaration(<ts.ModuleDeclaration>node); return;
            case ts.SyntaxKind.NamespaceExportDeclaration: this.processNamespaceDeclaration(<ts.NamespaceDeclaration>node); return;
            case ts.SyntaxKind.LabeledStatement: this.processLabeledStatement(<ts.LabeledStatement>node); return;
            case ts.SyntaxKind.ImportEqualsDeclaration: /*this.processImportEqualsDeclaration(<ts.ImportEqualsDeclaration>node);*/ return;
            case ts.SyntaxKind.ImportDeclaration:
                /*done in forward declaration*/ /*this.processImportDeclaration(<ts.ImportDeclaration>node);*/ return;
            case ts.SyntaxKind.TypeAliasDeclaration:
                /*done in forward Declaration*/
                if (enableTypeAliases) {
                    this.processTypeAliasDeclaration(<ts.TypeAliasDeclaration>node);
                }

                return;
            case ts.SyntaxKind.ExportAssignment: /*nothing to do*/ return;
        }

        // TODO: finish it
        throw new Error('Method not implemented.');
    }

    deep_expression=0;

    private processExpression(nodeIn: ts.Expression): ts.Expression {
        const node = this.preprocessor.preprocessExpression(nodeIn);
        if (!node) {
            return node;
        }
        
        this.deep_expression++;

        try {
        // we need to process it for statements only
        //// this.functionContext.code.setNodeToTrackDebugInfo(node, this.sourceMapGenerator);

        switch (node.kind) {
            case ts.SyntaxKind.NewExpression: this.processNewExpression(<ts.NewExpression>node); return node;
            case ts.SyntaxKind.CallExpression: this.processCallExpression(<ts.CallExpression>node); return node;
            case ts.SyntaxKind.PropertyAccessExpression: this.processPropertyAccessExpression(<ts.PropertyAccessExpression>node); return node;
            case ts.SyntaxKind.PrefixUnaryExpression: this.processPrefixUnaryExpression(<ts.PrefixUnaryExpression>node); return node;
            case ts.SyntaxKind.PostfixUnaryExpression: this.processPostfixUnaryExpression(<ts.PostfixUnaryExpression>node); return node;
            case ts.SyntaxKind.BinaryExpression: this.processBinaryExpression(<ts.BinaryExpression>node); return node;
            case ts.SyntaxKind.ConditionalExpression: this.processConditionalExpression(<ts.ConditionalExpression>node); return node;
            case ts.SyntaxKind.DeleteExpression: this.processDeleteExpression(<ts.DeleteExpression>node); return node;
            case ts.SyntaxKind.TypeOfExpression: this.processTypeOfExpression(<ts.TypeOfExpression>node); return node;
            case ts.SyntaxKind.FunctionExpression: this.processFunctionExpression(<ts.FunctionExpression>node); return node;
            case ts.SyntaxKind.ArrowFunction: this.processArrowFunction(<ts.ArrowFunction>node); return node;
            case ts.SyntaxKind.ElementAccessExpression: this.processElementAccessExpression(<ts.ElementAccessExpression>node); return node;
            case ts.SyntaxKind.ParenthesizedExpression: this.processParenthesizedExpression(<ts.ParenthesizedExpression>node); return node;
            case ts.SyntaxKind.TypeAssertionExpression: this.processTypeAssertionExpression(<ts.TypeAssertion>node); return node;
            case ts.SyntaxKind.VariableDeclarationList: this.processVariableDeclarationList(<ts.VariableDeclarationList><any>node); return node;
            case ts.SyntaxKind.TrueKeyword:
            case ts.SyntaxKind.FalseKeyword: this.processBooleanLiteral(<ts.BooleanLiteral>node); return node;
            case ts.SyntaxKind.NullKeyword: this.processNullLiteral(<ts.NullLiteral>node); return node;
            case ts.SyntaxKind.NumericLiteral: this.processNumericLiteral(<ts.NumericLiteral>node); return node;
            case ts.SyntaxKind.StringLiteral: this.processStringLiteral(<ts.StringLiteral>node); return node;
            case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
                this.processNoSubstitutionTemplateLiteral(<ts.NoSubstitutionTemplateLiteral>node); return node;
            case ts.SyntaxKind.ObjectLiteralExpression: this.processObjectLiteralExpression(<ts.ObjectLiteralExpression>node); return node;
            case ts.SyntaxKind.TemplateExpression: this.processTemplateExpression(<ts.TemplateExpression>node); return node;
            case ts.SyntaxKind.ArrayLiteralExpression: this.processArrayLiteralExpression(<ts.ArrayLiteralExpression>node); return node;
            case ts.SyntaxKind.RegularExpressionLiteral: this.processRegularExpressionLiteral(<ts.RegularExpressionLiteral>node); return node;
            case ts.SyntaxKind.ThisKeyword: this.processThisExpression(<ts.ThisExpression>node); return node;
            case ts.SyntaxKind.SuperKeyword: this.processSuperExpression(<ts.SuperExpression>node); return node;
            case ts.SyntaxKind.VoidExpression: this.processVoidExpression(<ts.VoidExpression>node); return node;
            case ts.SyntaxKind.NonNullExpression: this.processNonNullExpression(<ts.NonNullExpression>node); return node;
            case ts.SyntaxKind.AsExpression: this.processAsExpression(<ts.AsExpression>node); return node;
            case ts.SyntaxKind.SpreadElement: this.processSpreadElement(<ts.SpreadElement>node); return node;
            case ts.SyntaxKind.AwaitExpression: this.processAwaitExpression(<ts.AwaitExpression>node); return node;
            case ts.SyntaxKind.Identifier: this.processIdentifier(<ts.Identifier>node); return node;
            case ts.SyntaxKind.ComputedPropertyName: this.processComputedPropertyName(<ts.ComputedPropertyName><any>node); return node;
        }
        } finally {
            this.deep_expression--;
        }
        // TODO: finish it
        throw new Error('Method not implemented.');
    }

    private processDeclaration(node: ts.Declaration): void {
        switch (node.kind) {
            case ts.SyntaxKind.PropertySignature: this.processPropertyDeclaration(<ts.PropertySignature>node); return;
            case ts.SyntaxKind.PropertyDeclaration: this.processPropertyDeclaration(<ts.PropertyDeclaration>node); return;
            case ts.SyntaxKind.Parameter: this.processPropertyDeclaration(<ts.ParameterDeclaration>node); return;
            case ts.SyntaxKind.MethodSignature: this.processMethodDeclaration(<ts.MethodSignature>node); return;
            case ts.SyntaxKind.MethodDeclaration: this.processMethodDeclaration(<ts.MethodDeclaration>node); return;
            case ts.SyntaxKind.ConstructSignature: this.processMethodDeclaration(<ts.ConstructorDeclaration>node); return;
            case ts.SyntaxKind.Constructor: this.processMethodDeclaration(<ts.ConstructorDeclaration>node); return;
            case ts.SyntaxKind.SetAccessor: this.processMethodDeclaration(<ts.MethodDeclaration>node); return;
            case ts.SyntaxKind.GetAccessor: this.processMethodDeclaration(<ts.MethodDeclaration>node); return;
            case ts.SyntaxKind.FunctionDeclaration: this.processFunctionDeclaration(<ts.FunctionDeclaration>node); return;
            case ts.SyntaxKind.IndexSignature: /*TODO: index*/ return;
            case ts.SyntaxKind.SemicolonClassElement: /*TODO: index*/ return;
        }

        // TODO: finish it
        throw new Error('Method not implemented.');
    }

    private processInclude(nodeIn: ts.Declaration | ts.Statement, predecl: boolean): void {

        const node = this.preprocessor.preprocessStatement(<ts.Statement>nodeIn);

        switch (node.kind) {
            case ts.SyntaxKind.TypeAliasDeclaration: this.processTypeAliasImportDeclaration(<ts.TypeAliasDeclaration>node, predecl); return;
            case ts.SyntaxKind.ImportDeclaration: this.processImportDeclaration(<ts.ImportDeclaration>node, predecl); return;
            case ts.SyntaxKind.ExportDeclaration: this.processExportDeclaration(<ts.ExportDeclaration>node, predecl); return;
            default:
                return;
        }
    }

    private processForwardDeclaration(nodeIn: ts.Declaration | ts.Statement): void {

        const node = this.preprocessor.preprocessStatement(<ts.Statement>nodeIn);

        switch (node.kind) {
            case ts.SyntaxKind.VariableStatement: this.processVariablesForwardDeclaration(<ts.VariableStatement>node); return;
            case ts.SyntaxKind.InterfaceDeclaration:
            case ts.SyntaxKind.ClassDeclaration: this.processClassForwardDeclaration(<ts.ClassDeclaration>node); return;
            case ts.SyntaxKind.ModuleDeclaration: this.processModuleForwardDeclaration(<ts.ModuleDeclaration>node); return;
            case ts.SyntaxKind.EnumDeclaration: this.processEnumForwardDeclaration(<ts.EnumDeclaration>node); return;
            default:
                return;
        }
    }

    private processForwardDeclaration2(nodeIn: ts.Declaration | ts.Statement): void {

        const node = this.preprocessor.preprocessStatement(<ts.Statement>nodeIn);

        switch (node.kind) {
            case ts.SyntaxKind.VariableStatement: this.processVariablesForwardDeclaration(<ts.VariableStatement>node); return;
            case ts.SyntaxKind.InterfaceDeclaration:
            case ts.SyntaxKind.ClassDeclaration: this.processClassForwardDeclaration(<ts.ClassDeclaration>node); return;
            case ts.SyntaxKind.ModuleDeclaration: this.processModuleForwardDeclaration(<ts.ModuleDeclaration>node); return;
            case ts.SyntaxKind.EnumDeclaration: this.processEnumForwardDeclaration(<ts.EnumDeclaration>node); return;
            case ts.SyntaxKind.TypeAliasDeclaration: this.processTypeAliasDeclaration(<ts.TypeAliasDeclaration>node, true); return;
            default:
                return;
        }
    }

    public isTemplate(declaration: HasTemplate) {
        if (!declaration) {
            return false;
        }

        if (declaration.typeParameters && declaration.typeParameters.length > 0) {
            return true;
        }

        if (this.isMethodParamsTemplate(declaration)) {
            return true;
        }

        if (this.isClassMemberDeclaration(declaration)) {
            if (declaration.parent && declaration.parent.kind === ts.SyntaxKind.ClassDeclaration) {
                return this.isTemplate(<any>declaration.parent);
            }
        }

        return false;
    }

    private isTemplateType(effectiveType: any): boolean {
        if (!effectiveType) {
            return false;
        }

        if (effectiveType.kind === ts.SyntaxKind.UnionType) {
            return this.resolver.checkUnionType(effectiveType);
        }

        if (effectiveType.typeName && effectiveType.typeName.text === 'ArrayLike') {
            return true;
        }

        if (effectiveType.typeArguments && effectiveType.typeArguments.length > 0) {
            if (effectiveType.typeArguments.some(t => this.isTemplateType(t))) {
                return true;
            }
        }

        /*if (effectiveType.kind === ts.SyntaxKind.FunctionType
            && this.resolver.isTypeParameter(effectiveType.type)) {
            return true;
        }

        if (effectiveType.kind === ts.SyntaxKind.ConstructorType
            && this.resolver.isTypeParameter(effectiveType.type)) {
            return true;
        }*/

        if (this.resolver.isTypeAliasUnionType(effectiveType.typeName)) {
            return true;
        }
    }

    private isMethodParamsTemplate(declaration: HasTemplate): boolean {
        if (!declaration) {
            return false;
        }

        // if method has union type, it should be treated as generic method
        if (!this.isClassMemberDeclaration(declaration)
            && declaration.kind !== ts.SyntaxKind.FunctionDeclaration) {
            return false;
        }

        if (this.isTemplateType(declaration.type)) {
            return true;
        }

        if (declaration["parameters"]) {
            for (const element of (declaration as FuncExpr).parameters) {
                if (element.dotDotDotToken || this.isTemplateType(element.type)) {
                    return true;
                }
            }
        }
    }

    private processImplementation(nodeIn: ts.Declaration | ts.Statement, template?: boolean): void {

        const node = this.preprocessor.preprocessStatement(nodeIn);

        switch (node.kind) {
            case ts.SyntaxKind.ClassDeclaration: this.processClassImplementation(<ts.ClassDeclaration>node, template); return;
            case ts.SyntaxKind.ModuleDeclaration: this.processModuleImplementation(<ts.ModuleDeclaration>node, template); return;
            case ts.SyntaxKind.PropertyDeclaration:
                if (!template && this.isStatic(node)) {
                    this.processPropertyDeclaration(<ts.PropertyDeclaration>node, true);
                }

                return;
            case ts.SyntaxKind.Constructor:
            case ts.SyntaxKind.MethodDeclaration:
            case ts.SyntaxKind.GetAccessor:
            case ts.SyntaxKind.SetAccessor:
            case ts.SyntaxKind.FunctionDeclaration:
                if ((template && this.isTemplate(<ts.MethodDeclaration>node))
                    || (!template && !this.isTemplate(<ts.MethodDeclaration>node))) {
                    this.processMethodDeclaration(<ts.MethodDeclaration>node, true);
                }

                return;
            case ts.SyntaxKind.ImportEqualsDeclaration:
                if (!template) {
                    this.processImportEqualsDeclaration(<ts.ImportEqualsDeclaration>node);
                }

                return;
            default:
                return;
        }
    }

    private processModuleImplementation(node: ts.ModuleDeclaration, template?: boolean) {
        this.scope.push(node);
        this.processModuleImplementationInternal(node, template);
        this.scope.pop();
    }

    private processModuleImplementationInternal(node: ts.ModuleDeclaration, template?: boolean) {
        this.writer.writeString('namespace ');
        this.writer.writeString(node.name.text);
        this.writer.writeString(' ');
        this.writer.BeginBlock();

        if (node.body.kind === ts.SyntaxKind.ModuleBlock) {
            const block = <ts.ModuleBlock>node.body;
            block.statements.forEach(element => {
                this.processImplementation(element, template);
            });
        } else if (node.body.kind === ts.SyntaxKind.ModuleDeclaration) {
            this.processModuleImplementation(node.body, template);
        } else {
            throw new Error('Not Implemented');
        }

        this.writer.EndBlock();
    }

    private processClassImplementation(node: ts.ClassDeclaration, template?: boolean) {
        this.scope.push(node);
        this.processClassImplementationInternal(node, template);
        this.scope.pop();
    }

    private processClassImplementationInternal(node: ts.ClassDeclaration, template?: boolean) {

        if (this.isDeclare(node)) {
            return;
        }

        for (const member of node.members) {
            this.processImplementation(member, template);
        }
    }

    private processExpressionStatement(node: ts.ExpressionStatement): void {
        this.processExpression(node.expression);
        this.writer.EndOfStatement();
    }

    private fixupParentReferences<T extends ts.Node>(rootNode: T, setParent?: ts.Node): T {
        let parent: ts.Node = rootNode;
        if (setParent) {
            rootNode.parent = setParent;
        }

        ts.forEachChild(rootNode, visitNode);

        return rootNode;

        function visitNode(n: ts.Node): void {
            // walk down setting parents that differ from the parent we think it should be.  This
            // allows us to quickly bail out of setting parents for sub-trees during incremental
            // parsing
            if (n.parent !== parent) {
                n.parent = parent;

                const saveParent = parent;
                parent = n;
                ts.forEachChild(n, visitNode);

                parent = saveParent;
            }
        }
    }

    private transpileTSNode(node: ts.Node, transformText?: (string) => string) {
        return this.transpileTSCode(node.getFullText(), transformText);
    }

    private transpileTSCode(code: string, transformText?: (string) => string) {

        const opts = {
            module: ts.ModuleKind.CommonJS,
            alwaysStrict: false,
            noImplicitUseStrict: true,
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
            target: ts.ScriptTarget.ES5
        };

        const result = ts.transpileModule(code, { compilerOptions: opts });

        let jsText = result.outputText;
        if (transformText) {
            jsText = transformText(jsText);
        }

        return this.parseJSCode(jsText);
    }

    private parseTSCode(jsText: string) {

        const opts = {
            module: ts.ModuleKind.CommonJS,
            alwaysStrict: false,
            noImplicitUseStrict: true,
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
            target: ts.ScriptTarget.ES5
        };

        const sourceFile = ts.createSourceFile(
            this.sourceFileName, jsText, ts.ScriptTarget.ES5, /*setParentNodes */ true, ts.ScriptKind.TS);
        // needed to make typeChecker to work properly
        (<any>ts).bindSourceFile(sourceFile, opts);
        return sourceFile.statements;
    }

    private bind(node: ts.Statement) {

        const opts = {
            module: ts.ModuleKind.CommonJS,
            alwaysStrict: false,
            noImplicitUseStrict: true,
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
            target: ts.ScriptTarget.ES5
        };

        const sourceFile = ts.createSourceFile(
            this.sourceFileName, '', ts.ScriptTarget.ES5, /*setParentNodes */ true, ts.ScriptKind.TS);

        (<any>sourceFile.statements) = [node];

        (<any>ts).bindSourceFile(sourceFile, opts);

        return sourceFile.statements[0];
    }

    private parseJSCode(jsText: string) {

        const opts = {
            module: ts.ModuleKind.CommonJS,
            alwaysStrict: false,
            noImplicitUseStrict: true,
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
            target: ts.ScriptTarget.ES5
        };

        const sourceFile = ts.createSourceFile('partial', jsText, ts.ScriptTarget.ES5, /*setParentNodes */ true);
        this.fixupParentReferences(sourceFile);
        // needed to make typeChecker to work properly
        (<any>ts).bindSourceFile(sourceFile, opts);
        return sourceFile.statements;
    }

    private processTSNode(node: ts.Node, transformText?: (string) => string) {
        const statements = this.transpileTSNode(node, transformText);

        if (statements && statements.length === 1 && (<any>statements[0]).expression) {
            this.processExpression((<any>statements[0]).expression);
            return;
        }

        statements.forEach(s => {
            this.processStatementInternal(s);
        });
    }

    private processTSCode(code: string, parse?: any) {
        const statements = (!parse) ? this.transpileTSCode(code) : this.parseTSCode(code);
        statements.forEach(s => {
            this.processStatementInternal(s);
        });
    }

    private processJSCode(code: string) {
        const statements = this.parseJSCode(code);
        statements.forEach(s => {
            this.processStatementInternal(s);
        });
    }

    private processLabeledStatement(node: ts.LabeledStatement): void {
        this.processExpression(node.label);
        this.writer.writeStringNewLine(':');
        this.processStatement(node.statement);
    }

    private processTryStatement(node: ts.TryStatement): void {
        let anyCase = false;

        if (node.finallyBlock) {
            this.writer.BeginBlock();

            const finallyName = `__finally${node.finallyBlock.getFullStart()}_${node.finallyBlock.getEnd()}`;
            this.writer.writeString(`utils::finally ${finallyName}(`);

            const newArrowFunctions =
                ts.createArrowFunction(
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    node.finallyBlock);

            (<any>newArrowFunctions).__lambda_by_reference = true;

            this.processFunctionExpression(newArrowFunctions);

            this.writer.cancelNewLine();
            this.writer.writeString(')');
            this.writer.EndOfStatement();
        }

        this.writer.writeStringNewLine('try');
        this.writer.BeginBlock();

        node.tryBlock.statements.forEach(element => this.processStatement(element));

        this.writer.EndBlock();

        if (node.catchClause) {
            this.writer.writeString('catch (const ');
            if (node.catchClause.variableDeclaration.type) {
                this.processType(node.catchClause.variableDeclaration.type);
            } else {
                this.writer.writeString('any');
            }

            this.writer.writeString('& ');

            if (node.catchClause.variableDeclaration.name.kind === ts.SyntaxKind.Identifier) {
                this.processVariableDeclarationOne(
                    <ts.Identifier>(node.catchClause.variableDeclaration.name),
                    node.catchClause.variableDeclaration.initializer,
                    node.catchClause.variableDeclaration.type);
            } else {
                throw new Error('Method not implemented.');
            }

            this.writer.writeStringNewLine(')');
            this.processStatement(node.catchClause.block);

            anyCase = true;
        }

        if (!anyCase) {
            this.writer.writeStringNewLine('catch (...)');
            this.writer.BeginBlock();
            this.writer.writeString('throw');
            this.writer.EndOfStatement();
            this.writer.EndBlock();
        }

        if (node.finallyBlock) {
            this.writer.EndBlock();
        }
    }

    private processThrowStatement(node: ts.ThrowStatement): void {
        this.writer.writeString('throw');
        if (node.expression) {
            this.writer.writeString(' any(');
            this.processExpression(node.expression);
            this.writer.writeString(')');
        }

        this.writer.EndOfStatement();
    }

    private processTypeOfExpression(node: ts.TypeOfExpression): void {
        this.writer.writeString('type_of(');
        this.processExpression(node.expression);
        this.writer.writeString(')');
    }

    private processDebuggerStatement(node: ts.DebuggerStatement): void {
        this.writer.writeString('__asm { int 3 }');
    }

    private processEnumForwardDeclaration(node: ts.EnumDeclaration): void {
        this.writer.writeStringNewLine("// Module");
        this.scope.push(node);
        this.processEnumForwardDeclarationInternal(node);
        this.scope.pop();
    }

    private processEnumForwardDeclarationInternal(node: ts.EnumDeclaration): void {

        if (!this.isHeader()) {
            return;
        }

        this.writer.writeString('enum struct ');
        this.processIdentifier(node.name);
        this.writer.writeString(' : std::size_t ');
        this.writer.EndOfStatement();
    }

    private processEnumDeclaration(node: ts.EnumDeclaration): void {
        this.scope.push(node);
        this.processEnumDeclarationInternal(node);
        this.scope.pop();
    }

    private processEnumDeclarationInternal(node: ts.EnumDeclaration): void {

        if (!this.isHeader()) {
            return;
        }

        if (this.isDeclare(node)) {
            return;
        }

        /*
        const properties = [];
        let value = 0;
        for (const member of node.members) {
            if (member.initializer) {
                switch (member.initializer.kind) {
                    case ts.SyntaxKind.NumericLiteral:
                        value = parseInt((<ts.NumericLiteral>member.initializer).text, 10);
                        break;
                    default:
                        throw new Error('Not Implemented');
                }
            } else {
                value++;
            }

            const namedProperty = ts.createPropertyAssignment(
                member.name,
                ts.createNumericLiteral(value.toString()));

            const valueProperty = ts.createPropertyAssignment(
                ts.createNumericLiteral(value.toString()),
                ts.createStringLiteral((<ts.Identifier>member.name).text));

            properties.push(namedProperty);
            properties.push(valueProperty);
        }

        const enumLiteralObject = ts.createObjectLiteral(properties);
        const varDecl = ts.createVariableDeclaration(node.name, undefined, enumLiteralObject);
        const enumDeclare = ts.createVariableStatement([], [varDecl]);

        this.processStatement(this.fixupParentReferences(enumDeclare, node));
        */

        let w0:CodeWriter, w1:CodeWriter, w2:CodeWriter, w02:CodeWriter;

        let ow0 = this.writer;

        try {
            this.writer = w0 = new CodeWriter();
            w1 = new CodeWriter();
            w2 = new CodeWriter();
            w02 = new CodeWriter();

            this.processIdentifier(node.name);
            const id = w0.getText();

            w1.writeString('enum struct ');
            w1.writeString(id);
            w1.writeString(" : std::size_t ");
            w1.BeginBlock();

            w02.writeString('struct Enum_');
            w02.writeString(id);
            w02.writeString(" ");
            w02.BeginBlock();
            w02.writeString('inline static js::string* names() ');
            w02.BeginBlock();
            w02.writeStringNewLine('static bool initialized=false;');
            w02.writeString('static js::string result[');

            w2.Indent();
            w2.Indent();
            w2.writeStringNewLine('if (!initialized)');
            w2.BeginBlock();
            w2.writeStringNewLine('initialized=true;');

            let next = false;
            let idCnt = 0;
            for (const member of node.members) {
                if (next) {
                    w1.writeString(', ');
                }

                let name:string;
                if (member.name.kind === ts.SyntaxKind.Identifier) {
                    let ow = this.writer;
                    try {
                        this.writer = new CodeWriter();
                        this.processExpression(member.name);
                        name = this.writer.getText();
                    } finally {
                        this.writer = ow;
                    }
                } else {
                    throw new Error('Not Implemented');
                }
                w1.writeString(name);

                let w2_ok = false;
                if (member.initializer) {
                    let litnode:ts.Expression = null;
                    let output:string = "";
                    let ow = this.writer;
                    try {
                        this.writer = new CodeWriter();
                        litnode = this.processExpression(member.initializer);
                        output = this.writer.getText();
                    } finally {
                        this.writer = ow;
                    }
                    if (litnode) {
                        switch (litnode.kind) {
                            case ts.SyntaxKind.NumericLiteral:
                                w1.writeString(' = ');
                                w1.writeString(output);
                                idCnt = Number(output) + 1;
                                break;
                            case ts.SyntaxKind.StringLiteral: 
                                w2_ok = true;
                                w2.writeString("result[(std::size_t)");
                                w2.writeString(id);
                                w2.writeString("::"+name+"] = ");
                                w2.writeString(output);
                                w2.EndOfStatement();
                                idCnt++;
                                break;
                            default:
                                console.warn('Enum value syntax not implemented : '+output+" kind:"+ts.SyntaxKind[litnode.kind]);
                                break;
                        }
                    }

                } else {
                    idCnt++;
                }
                if (!w2_ok) {
                    w2_ok = true;
                    w2.writeString("result[(std::size_t)");
                    w2.writeString(id);
                    w2.writeString("::"+name+"] = \"");
                    w2.writeString(name);
                    w2.writeString("\"");
                    w2.EndOfStatement();
                }

                next = true;
            }

            w1.EndBlock();
            w1.EndOfStatement();

            w2.EndBlock();
            w2.writeString('return result;');
            w2.EndBlock();

            w2.writeString('inline static js::string const & name('+id+' value) ');
            w2.BeginBlock();
            w2.writeStringNewLine('return Enum_'+id+"::names()[(std::size_t)value];");
            w2.EndBlock();

            w2.EndBlock();
            w2.EndOfStatement();

            w02.writeString(""+(idCnt));
            w02.writeString("]");
            w02.EndOfStatement();

            ow0.writeString(w1.getText());
            ow0.writeString(w02.getText());
            ow0.writeString(w2.getText());

        } finally {
            this.writer = ow0;
        }

    }

    private hasAccessModifier(modifiers: ts.ModifiersArray) {
        if (!modifiers) {
            return false;
        }

        return modifiers
            .some(m => m.kind === ts.SyntaxKind.PrivateKeyword
                || m.kind === ts.SyntaxKind.ProtectedKeyword
                || m.kind === ts.SyntaxKind.PublicKeyword);
    }

    private processVariablesForwardDeclaration(node: ts.VariableStatement) {
        this.writer.writeStringNewLine("// Variables");
        if (this.processVariableDeclarationList(node.declarationList, true)) {
            this.writer.EndOfStatement();
        }
    }

    private processClassForwardDeclaration(node: ts.ClassDeclaration) {
        this.writer.writeStringNewLine("// Class");
        this.scope.push(node);
        this.processClassForwardDeclarationInternal(node);
        this.scope.pop();

        this.writer.EndOfStatement();
    }

    private processClassForwardDeclarationInternal(node: ts.ClassDeclaration | ts.InterfaceDeclaration) {
        let next = false;
        if (node.typeParameters) {
            this.writer.writeString('template <');
            node.typeParameters.forEach(type => {
                if (next) {
                    this.writer.writeString(', ');
                }
                this.processType(type);
                next = true;
            });
            this.writer.writeStringNewLine('>');
        }
        this.writer.writeString('class ');
        this.processIdentifier(node.name);
    }

    private processModuleForwardDeclaration(node: ts.ModuleDeclaration, template?: boolean) {
        this.writer.writeStringNewLine("// Module");
        this.scope.push(node);
        this.processModuleForwardDeclarationInternal(node, template);
        this.scope.pop();
    }

    private processModuleForwardDeclarationInternal(node: ts.ModuleDeclaration, template?: boolean) {
        this.writer.writeString('namespace ');
        this.writer.writeString(node.name.text);
        this.writer.writeString(' ');
        this.writer.BeginBlock();

        if (node.body.kind === ts.SyntaxKind.ModuleBlock) {
            const block = <ts.ModuleBlock>node.body;
            block.statements.forEach(element => {
                this.processForwardDeclaration(element);
            });
        } else if (node.body.kind === ts.SyntaxKind.ModuleDeclaration) {
            this.processModuleForwardDeclaration(node.body, template);
        } else {
            throw new Error('Not Implemented');
        }

        this.writer.EndBlock();
    }

    private isInBaseClass(baseClass: ts.TypeNode, identifier: ts.Identifier): boolean {

        const effectiveSymbol = (<any>baseClass).symbol || ((<any>baseClass).exprName).symbol;

        if (!effectiveSymbol
            || !effectiveSymbol.valueDeclaration
            || !effectiveSymbol.valueDeclaration.heritageClauses) {
            return false;
        }

        const hasInBase = effectiveSymbol.valueDeclaration
            .heritageClauses.some(hc => hc.types.some(t => t.expression.text === identifier.text));

        return hasInBase;
    }

    wasCurClassConstructorInStack: boolean = false;

    private processClassDeclaration(node: ts.ClassDeclaration | ts.InterfaceDeclaration) {
        let w:boolean;
        try {
            w = this.wasCurClassConstructorInStack;
            this.wasCurClassConstructorInStack = false;
            this.scope.push(node);
            this.processClassDeclarationInternal(node);
            this.scope.pop();    
        } finally {
            this.wasCurClassConstructorInStack = w;
        }
    }

    private processClassDeclarationInternal(node: ts.ClassDeclaration | ts.InterfaceDeclaration): void {
        if (!this.isHeader()) {
            return;
        }

        this.processClassForwardDeclarationInternal(node);

        let next = false;
        let supercl0;
        if (node.heritageClauses) {
            let baseClass;
            node.heritageClauses.forEach(heritageClause => {
                heritageClause.types.forEach(type => {
                    if (type.expression.kind === ts.SyntaxKind.Identifier) {
                        const identifier = <ts.Identifier>type.expression;

                        if (baseClass && this.isInBaseClass(baseClass, identifier)) {
                            return;
                        }

                        if (!baseClass) {
                            baseClass = this.resolver.getOrResolveTypeOfAsTypeNode(identifier);
                        }

                        if (next) {
                            this.writer.writeString(', ');
                        } else {
                            this.writer.writeString(' : ');
                        }

                        this.writer.writeString('public ');
                        let supercl="";
                        let ow = this.writer;
                        try {
                            this.writer = new CodeWriter();

                            this.writer.writeString(identifier.text);

                            this.processTemplateArguments(type, true);

                            supercl = this.writer.getText();
                            if (!supercl0) {
                                supercl0 = supercl;
                            }
                        } finally {
                            this.writer = ow;
                        }
                        this.writer.writeString(supercl);

                        next = true;
                    } else {
                        /* TODO: finish xxx.yyy<zzz> */
                    }

                });
            });
        } else {
            this.writer.writeString(' : public object');
        }
        if(!supercl0) supercl0="object";

        // Not required:
        // already done in core.h/tmpl::object and also "virtual ~object()" :
        //this.writer.writeString(', public std::enable_shared_from_this<');
        //this.processIdentifier(node.name);
        //this.processTemplateParameters(<ts.ClassDeclaration>node);
        //this.writer.writeString('>');

        this.writer.writeString(' ');
        this.writer.BeginBlock();
        this.writer.DecreaseIntent();
        this.writer.writeString('public:');
        this.writer.IncreaseIntent();
        this.writer.writeStringNewLine();
        this.writer.writeStringNewLine("typedef "+supercl0+" _Super_;");
        this.writer.writeStringNewLine();

        //this.writer.writeString('using std::enable_shared_from_this<');
        //this.processIdentifier(node.name);
        //this.processTemplateParameters(<ts.ClassDeclaration>node);
        //this.writer.writeStringNewLine('>::shared_from_this;');

        /*
        if (!node.heritageClauses) {
            // to make base class polymorphic
            this.writer.writeStringNewLine('virtual void dummy() {};');
        }
        */

        // declare all private parameters of constructors
        for (const constructor of <ts.ConstructorDeclaration[]>(<ts.ClassDeclaration>node)
            .members.filter(m => m.kind === ts.SyntaxKind.Constructor)) {
            for (const fieldAsParam of constructor.parameters.filter(p => this.hasAccessModifier(p.modifiers))) {
                this.processDeclaration(fieldAsParam);
            }
        }

        const propertyWithThis = (m: ts.Node) => {
            return m.kind === ts.SyntaxKind.PropertyDeclaration && this.hasThis(m);
        };

        for (const member of (<any[]><any>node.members).filter(m => !propertyWithThis(m))) {
            this.processDeclaration(member);
        }

        for (const member of (<any[]><any>node.members).filter(m => propertyWithThis(m))) {
            this.processDeclaration(member);
        }

        this.writer.cancelNewLine();
        this.writer.cancelNewLine();

        this.writer.EndBlock();
        this.writer.EndOfStatement();

        this.writer.writeStringNewLine();

        if (node.modifiers && node.modifiers.some(m => m.kind === ts.SyntaxKind.DefaultKeyword)) {
            this.writer.writeString('using _default = ');
            this.processIdentifier(node.name);
            this.processTemplateParameters(<ts.ClassDeclaration>node);
            this.writer.writeStringNewLine(';');
        }
    }

    private processPropertyDeclaration(node: ts.PropertyDeclaration | ts.PropertySignature | ts.ParameterDeclaration,
        implementationMode?: boolean): void {
        if (!implementationMode) {
            this.processModifiers(node.modifiers);
        }

        const effectiveType = node.type
            || this.resolver.getOrResolveTypeOfAsTypeNode(node.initializer);
        this.processPredefineType(effectiveType);
        this.processType(effectiveType);
        this.writer.writeString(' ');

        if (node.name.kind === ts.SyntaxKind.Identifier) {
            if (implementationMode) {
                // write class name
                const classNode = this.scope[this.scope.length - 1];
                if (classNode.kind === ts.SyntaxKind.ClassDeclaration) {
                    this.writer.writeString((<ts.ClassDeclaration>classNode).name.text);
                    this.writer.writeString('::');
                } else {
                    throw new Error('Not Implemented');
                }
            }

            this.processExpression(node.name);
        } else {
            throw new Error('Not Implemented');
        }

        const isStatic = this.isStatic(node);
        if (node.initializer && (implementationMode && isStatic || !isStatic)) {
            this.writer.writeString(' = ');
            this.processExpression(node.initializer);
        }

        this.writer.EndOfStatement();

        this.writer.writeStringNewLine();
    }

    private processMethodDeclaration(node: ts.MethodDeclaration | ts.MethodSignature | ts.ConstructorDeclaration,
        implementationMode?: boolean): void {
        const skip = this.processFunctionDeclaration(<ts.FunctionDeclaration><any>node, implementationMode);
        if (implementationMode) {
            if (!skip) {
                this.writer.writeStringNewLine();
            }
        } else {
            this.writer.EndOfStatement();
        }
    }

    private processModifiers(modifiers: ts.NodeArray<ts.Modifier>) {
        if (!modifiers) {
            return;
        }

        modifiers.forEach(modifier => {
            switch (modifier.kind) {
                case ts.SyntaxKind.StaticKeyword:
                    this.writer.writeString('static ');
                    break;
            }
        });
    }

    private processTypeAliasImportDeclaration(node: ts.TypeAliasDeclaration, predecl: boolean): boolean {
        if (this.isDeclare(node)) {
            return;
        }

        if (node.type.kind === ts.SyntaxKind.ImportType) {
            const typeLiteral = <ts.ImportTypeNode>node.type;
            const argument = typeLiteral.argument;
            if (argument.kind === ts.SyntaxKind.LiteralType) {
                const literal = <ts.LiteralTypeNode>argument;
                this.writer.writeString('#include \"');
                this.writer.writeString((<any>literal.literal).text);
                if (predecl)
                    this.writer.writeString("_pre");
                this.writer.writeStringNewLine('.h\"');
            } else {
                throw new Error('Not Implemented');
            }

            return true;
        }
        return false;
    }

    private processTypeAliasDeclaration(node: ts.TypeAliasDeclaration, predecl=false): void {
        if (this.isDeclare(node)) {
            return;
        }

        if (!predecl && node.type.kind === ts.SyntaxKind.ImportType) {
            this.processTypeAliasImportDeclaration(node, false);
            return;
        }

        const name = node.name.text;
        // remove NULL from union types, do we need to remove "undefined" as well?
        let type = node.type;
        if (type.kind === ts.SyntaxKind.AnyKeyword
            || type.kind === ts.SyntaxKind.NumberKeyword && this.embeddedCPPTypes.some((e) => e === name)) {
            return;
        }

        this.processPredefineType(type);

        if (node.type.kind === ts.SyntaxKind.UnionType) {
            const unionType = <ts.UnionTypeNode>type;
            const filtered = unionType.types.filter(t => t.kind !== ts.SyntaxKind.NullKeyword && t.kind !== ts.SyntaxKind.UndefinedKeyword);
            if (filtered.length === 1) {
                type = filtered[0];
            }
        } else if (node.type.kind === ts.SyntaxKind.ConditionalType) {
            const conditionType = <ts.ConditionalTypeNode>type;
            type = conditionType.checkType;
        } else if (node.type.kind === ts.SyntaxKind.MappedType) {
            if (node.typeParameters && node.typeParameters[0]) {
                type = <any>{ kind: ts.SyntaxKind.TypeParameter, name: ts.createIdentifier((<any>(node.typeParameters[0])).symbol.name) };
            }
        }

        if (node.typeParameters) {
            this.processTemplateParams(node);
            this.writer.writeString('using ');
            this.processExpression(node.name);
            this.writer.writeString(' = ');
            this.processType(type, false, true, true);
        } else {
            // default typedef
            this.writer.writeString('typedef ');
            this.processType(type, false, true, true);
            this.writer.writeString(' ');
            this.processExpression(node.name);
        }

        this.writer.EndOfStatement();
        this.writer.writeStringNewLine();
    }

    private processModuleDeclaration(node: ts.ModuleDeclaration): void {
        this.writer.writeString('namespace ');
        this.processExpression(node.name);
        this.writer.writeString(' ');

        this.writer.BeginBlock();

        if (node.body.kind === ts.SyntaxKind.ModuleBlock) {
            const block = <ts.ModuleBlock>node.body;
            block.statements.forEach(s => {
                if (this.isDeclarationStatement(s) || this.isVariableStatement(s)) {
                    this.processStatement(s);
                } else if (this.isNamespaceStatement(s)) {
                    this.processModuleDeclaration(<ts.ModuleDeclaration>s);
                }
            });
        } else if (node.body.kind === ts.SyntaxKind.ModuleDeclaration) {
            this.processModuleDeclaration(node.body);
        } else {
            throw new Error('Not Implemented');
        }

        this.writer.EndBlock();
    }

    private processNamespaceDeclaration(node: ts.NamespaceDeclaration): void {
        this.processModuleDeclaration(node);
    }

    private processModuleImplementationInMain(node: ts.ModuleDeclaration | ts.NamespaceDeclaration): void {
        if (node.body.kind === ts.SyntaxKind.ModuleBlock) {
            const block = <ts.ModuleBlock>node.body;
            block.statements.forEach(s => {
                if (!this.isDeclarationStatement(s) && !this.isVariableStatement(s)) {
                    this.processStatement(s);
                } else if (this.isNamespaceStatement(s)) {
                    this.processModuleImplementationInMain(<ts.ModuleDeclaration>s);
                }
            });
        } else if (node.body.kind === ts.SyntaxKind.ModuleDeclaration) {
            this.processModuleImplementationInMain(node.body);
        } else {
            throw new Error('Not Implemented');
        }
    }

    private processModuleVariableStatements(node: ts.ModuleDeclaration | ts.NamespaceDeclaration): void {
        if (node.body.kind === ts.SyntaxKind.ModuleBlock) {
            const block = <ts.ModuleBlock>node.body;
            block.statements.forEach(s => {
                if (this.isVariableStatement(s)) {
                    this.processStatement(s);
                } else if (this.isNamespaceStatement(s)) {
                    this.processModuleVariableStatements(<ts.ModuleDeclaration>s);
                }
            });
        } else if (node.body.kind === ts.SyntaxKind.ModuleDeclaration) {
            this.processModuleVariableStatements(node.body);
        } else {
            throw new Error('Not Implemented');
        }
    }

    private processImportEqualsDeclaration(node: ts.ImportEqualsDeclaration): void {

        const typeOfExpr = this.resolver.getOrResolveTypeOf(node.moduleReference);
        if (typeOfExpr && typeOfExpr.symbol &&
            (typeOfExpr.symbol.valueDeclaration.kind === ts.SyntaxKind.ModuleDeclaration
                || typeOfExpr.symbol.valueDeclaration.kind === ts.SyntaxKind.NamespaceExportDeclaration)) {
            this.writer.writeString('namespace ');
        } else {
            this.writer.writeString('using ');
        }

        this.processExpression(node.name);
        this.writer.writeString(' = ');
        this.processModuleReferenceOrEntityName(node.moduleReference);
        this.writer.EndOfStatement();
    }

    private processModuleReferenceOrEntityName(node: ts.ModuleReference | ts.EntityName) {
        switch (node.kind) {
            case ts.SyntaxKind.Identifier: this.processIdentifier(node); break;
            case ts.SyntaxKind.QualifiedName: this.processQualifiedName(node); break;
            case ts.SyntaxKind.ExternalModuleReference: this.processExpression(node.expression); break;
        }
    }

    private processQualifiedName(node: ts.QualifiedName) {
        this.processModuleReferenceOrEntityName(node.left);
        this.writer.writeString('::');
        this.processExpression(node.right);
    }

    private processExportDeclaration(node: ts.ExportDeclaration, predecl: boolean): void {
        this.writer.writeString('#include \"');
        if (node.moduleSpecifier.kind === ts.SyntaxKind.StringLiteral) {
            const ident = <ts.StringLiteral>node.moduleSpecifier;
            if (ident.text==".") {
                this.writer.writeString("./index");
            } else {
                this.writer.writeString(ident.text);
            }
            if (predecl)
                this.writer.writeString("_pre");
            this.writer.writeString('.h');
        }

        this.writer.writeStringNewLine('\"');
        /* TODO: ?*/
    }

    private processImportDeclaration(node: ts.ImportDeclaration, predecl: boolean): void {

        if (node.moduleSpecifier.kind !== ts.SyntaxKind.StringLiteral) {
            return;
        }

        this.writer.writeString('#include \"');
        if (node.moduleSpecifier.kind === ts.SyntaxKind.StringLiteral) {
            const ident = <ts.StringLiteral>node.moduleSpecifier;
            if (ident.text==".") {
                this.writer.writeString("./index");
            } else {
                this.writer.writeString(ident.text);
            }
            if (predecl)
                this.writer.writeString("_pre");
            this.writer.writeString('.h');
        }

        this.writer.writeStringNewLine('\"');

        if (node.importClause) {
            if (node.importClause.name && node.importClause.name.kind === ts.SyntaxKind.Identifier) {
                this.writer.writeString('using ');
                this.processExpression(node.importClause.name);
                this.writer.writeStringNewLine(' = _default;');
            }

            if (node.importClause.namedBindings
                && node.importClause.namedBindings.kind === ts.SyntaxKind.NamedImports) {
                for (const binding of (<ts.NamedImports>node.importClause.namedBindings).elements.filter(e => e.propertyName)) {
                    this.writer.writeString('using ');
                    this.processExpression(binding.name);
                    this.writer.writeString(' = ');
                    this.processExpression(binding.propertyName);
                    this.writer.writeStringNewLine(';');
                }
            }
        }
    }

    private processVariableDeclarationList(declarationList: ts.VariableDeclarationList, forwardDeclaration?: boolean): boolean {

        if (this.isDeclare(declarationList.parent) && !forwardDeclaration) {
            return false;
        }

        const scopeItem = this.scope[this.scope.length - 1];
        const autoAllowed =
            scopeItem.kind !== ts.SyntaxKind.SourceFile
            && scopeItem.kind !== ts.SyntaxKind.ClassDeclaration
            && scopeItem.kind !== ts.SyntaxKind.ModuleDeclaration
            && scopeItem.kind !== ts.SyntaxKind.NamespaceExportDeclaration;

        //const forceCaptureRequired = autoAllowed && declarationList.declarations.some(d => d && (<any>d).__requireCapture);
        if (!((<any>declarationList).__ignore_type)) {

            if (forwardDeclaration) {
                this.writer.writeString('extern ');
            }

            const firstType = declarationList.declarations.filter(d => d.type)[0]?.type;
            const firstInitializer = declarationList.declarations.filter(d => d.initializer)[0]?.initializer;
            const effectiveType = firstType || this.resolver.getOrResolveTypeOfAsTypeNode(firstInitializer);
            const useAuto = autoAllowed && !!(firstInitializer);
            this.processPredefineType(effectiveType);
            //if (!forceCaptureRequired) {
                this.processType(effectiveType, useAuto);
            /*} else {
                if (useAuto) {
                    this.writer.writeString('shared');
                } else {
                    this.writer.writeString('shared<');
                    this.processType(effectiveType, useAuto);
                    this.writer.writeString('>');
                }
            }*/

            this.writer.writeString(' ');
        }

        const next = { next: false };
        let result = false;
        declarationList.declarations.forEach(d => {
                result =
                    this.processVariableDeclarationOne(
                        d.name, d.initializer, d.type, next, forwardDeclaration/*, forceCaptureRequired*/)
                    || result;
            } );

        return result;
    }

    private processVariableDeclarationOne(
        name: ts.BindingName,
        initializer: ts.Expression,
        type: ts.TypeNode,
        next?: { next: boolean },
        forwardDeclaration?: boolean/*,
        forceCaptureRequired?: boolean*/): boolean {
        if (next && next.next) {
            this.writer.writeString(', ');
        }

        if (name.kind === ts.SyntaxKind.ArrayBindingPattern) {
            this.writer.writeString('[');
            let hasNext = false;
            name.elements.forEach(element => {
                if (hasNext) {
                    this.writer.writeString(', ');
                }

                hasNext = true;
                this.writer.writeString((<ts.Identifier>(<ts.BindingElement>element).name).text);
            });
            this.writer.writeString(']');
        } else if (name.kind === ts.SyntaxKind.Identifier) {
            this.writer.writeString(name.text);
        } else {
            throw new Error('Not implemented!');
        }

        if (!forwardDeclaration) {
            if (initializer) {
                this.writer.writeString(' = ');
                this.processExpression(initializer);
            } else {
                if (type && type.kind === ts.SyntaxKind.TupleType) {
                    this.processDefaultValue(type);
                }
            }
        }

        if (next) {
            next.next = true;
        }

        return true;
    }

    private processVariableStatement(node: ts.VariableStatement): void {
        const anyVal = this.processVariableDeclarationList(node.declarationList);
        if (anyVal) {
            this.writer.EndOfStatement();
        }
    }

    private processPredefineType(typeIn: ts.TypeNode | ts.ParameterDeclaration | ts.TypeParameterDeclaration | ts.Expression,
        auto: boolean = false): void {

        if (auto) {
            return;
        }

        let type = typeIn;
        if (typeIn && typeIn.kind === ts.SyntaxKind.LiteralType) {
            type = (<ts.LiteralTypeNode>typeIn).literal;
        }

        switch (type && type.kind) {
            case ts.SyntaxKind.ArrayType:
                const arrayType = <ts.ArrayTypeNode>type;
                this.processPredefineType(arrayType.elementType, false);

                break;
            case ts.SyntaxKind.TupleType:
                const tupleType = <ts.TupleTypeNode>type;

                tupleType.elementTypes.forEach(element => {
                    this.processPredefineType(element, false);
                });

                break;
            case ts.SyntaxKind.TypeReference:
                const typeReference = <ts.TypeReferenceNode>type;

                if (typeReference.typeArguments) {
                    typeReference.typeArguments.forEach(element => {
                        this.processPredefineType(element, false);
                    });
                }

                break;
            case ts.SyntaxKind.Parameter:
                const parameter = <ts.ParameterDeclaration>type;
                if (parameter.name.kind === ts.SyntaxKind.Identifier) {
                    this.processPredefineType(parameter.type);
                } else {
                    throw new Error('Not Implemented');
                }

                break;
            case ts.SyntaxKind.FunctionType:
            case ts.SyntaxKind.ConstructorType:
                const functionType = <ts.FunctionTypeNode>type;
                this.processPredefineType(functionType.type);
                if (functionType.parameters) {
                    functionType.parameters.forEach(element => {
                        this.processPredefineType(element);
                    });
                }
                break;
            case ts.SyntaxKind.UnionType:

                /*
                const unionType = <ts.UnionTypeNode>type;
                const unionTypes = unionType.types
                    .filter(f => f.kind !== ts.SyntaxKind.NullKeyword && f.kind !== ts.SyntaxKind.UndefinedKeyword);

                if (this.typesAreNotSame(unionTypes)) {
                    unionTypes.forEach((element, i) => {
                        this.processPredefineType(element);
                    });

                    this.processType(type, undefined, undefined, undefined, true);
                    this.writer.EndOfStatement();
                } else {
                    this.processPredefineType(unionTypes[0]);
                }
                */
                break;
        }
    }

    private compareTypes(t1: ts.TypeNode, t2: ts.TypeNode): boolean {
        let kind1=ts.SyntaxKind.Unknown;
        if (t1) {
            kind1 = t1.kind === ts.SyntaxKind.LiteralType ? (<ts.LiteralTypeNode>t1).literal.kind : t1.kind;
        }
        let kind2=ts.SyntaxKind.Unknown;
        if (t2) {
            kind2 = t2.kind === ts.SyntaxKind.LiteralType ? (<ts.LiteralTypeNode>t2).literal.kind : t2.kind;
        }
        return kind1 === kind2;
    }

    private typesAreNotSame(unionTypes: ts.TypeNode[]): boolean {
        if (unionTypes.length <= 1) {
            return false;
        }

        const firstType = unionTypes[0];
        const same = unionTypes.slice(1).every(t => this.compareTypes(t, firstType));
        return !same;
    }

    private processType(typeIn: ts.TypeNode | ts.ParameterDeclaration | ts.TypeParameterDeclaration | ts.Expression,
        auto: boolean = false, skipPointerInType: boolean = false, noTypeName: boolean = false,
        implementingUnionType: boolean = false, isParam : boolean = false): void {

        if (auto) {
            this.writer.writeString('auto');
            return;
        }

        let type = typeIn;
        if (typeIn && typeIn.kind === ts.SyntaxKind.LiteralType) {
            type = (<ts.LiteralTypeNode>typeIn).literal;
        }

        const typeInfo = this.resolver.getOrResolveTypeOf(type);

        // detect if pointer
        const skipPointerIf =
            (typeInfo && (<any>typeInfo).symbol && (<any>typeInfo).symbol.name === '__type')
            || (typeInfo && (<any>typeInfo).primitiveTypesOnly)
            || (typeInfo && (<any>typeInfo).intrinsicName === 'number')
            || this.resolver.isTypeFromSymbol(typeInfo, ts.SyntaxKind.TypeParameter)
            || this.resolver.isTypeFromSymbol(typeInfo, ts.SyntaxKind.EnumMember)
            || this.resolver.isTypeFromSymbol(typeInfo, ts.SyntaxKind.EnumDeclaration)
            || (type && this.resolver.isTypeFromSymbol((<any>type).typeName, ts.SyntaxKind.EnumDeclaration))
            || skipPointerInType
            ;

        let next;
        switch (type && type.kind) {
            case ts.SyntaxKind.ParenthesizedType:
                const parenthesizedType = <ts.ParenthesizedTypeNode>type;
                this.writer.writeString('(');
                this.processType(parenthesizedType.type, auto, skipPointerInType, 
                    noTypeName, implementingUnionType, isParam);
                this.writer.writeString(')');
                break;
            case ts.SyntaxKind.TrueKeyword:
            case ts.SyntaxKind.FalseKeyword:
            case ts.SyntaxKind.BooleanKeyword:
                this.writer.writeString('boolean');
                break;
            case ts.SyntaxKind.NumericLiteral:
            case ts.SyntaxKind.NumberKeyword:
                this.writer.writeString('js::number');
                break;
            case ts.SyntaxKind.StringLiteral:
            case ts.SyntaxKind.StringKeyword:
                this.writer.writeString('string');
                break;
            case ts.SyntaxKind.TypeLiteral:
            case ts.SyntaxKind.ObjectLiteralExpression:
                this.writer.writeString('$S<object>');
                break;
            case ts.SyntaxKind.ArrayType:
                const arrayType = <ts.ArrayTypeNode>type;
                if (/*isParam && */!skipPointerIf) {
                    this.writer.writeString('$S<');
                }
                this.writer.writeString('array<');
                if (arrayType.elementType && arrayType.elementType.kind !== ts.SyntaxKind.UndefinedKeyword) {
                    this.processType(arrayType.elementType/*, false, true*/);

                } else {
                    this.writer.writeString('any');
                }
                this.writer.writeString('>');
                if (/*isParam && */!skipPointerIf) {
                    this.writer.writeString('>');
                }
                break;
            case ts.SyntaxKind.TupleType:
                const tupleType = <ts.TupleTypeNode>type;

                this.writer.writeString('std::tuple<');

                next = false;
                tupleType.elementTypes.forEach(element => {
                    if (next) {
                        this.writer.writeString(', ');
                    }

                    this.processType(element);
                    next = true;
                });

                this.writer.writeString('>');
                break;
            case ts.SyntaxKind.TypeReference:
                const typeReference = <ts.TypeReferenceNode>type;
                let isTypeAlias = false;
                try {
                    isTypeAlias = ((typeInfo && this.resolver.checkTypeAlias(typeInfo.aliasSymbol))
                    || this.resolver.isTypeAlias((<any>type).typeName)) && !this.resolver.isThisType(typeInfo);
                } catch (drop){}
                const isReadonly = typeReference && typeReference.typeArguments && typeReference.typeArguments.length==1 && 
                    typeReference.typeName && typeReference.typeName.getSourceFile() && typeReference.typeName.getText()=="Readonly";
                const isEnum = this.isEnum(typeReference);
                const isArray = this.resolver.isArrayType(typeInfo);

                // detect if pointer
                const skipPointerIfA =
                    skipPointerIf
                    || isEnum
                    || isTypeAlias
                    //|| isReadonly
                    //|| isArray
                    ;

                if (!skipPointerIfA) {
                    this.writer.writeString('$S<');
                }

                // writing namespace
                if (this.isWritingMain) {
                    const symbol = (<any>typeReference.typeName).symbol || typeInfo && typeInfo.symbol;
                    if (symbol) {
                        const symbolDecl = symbol.valueDeclaration || symbol.declarations[0];
                        if (symbolDecl) {
                            let parent = symbolDecl.parent;
                            if (parent) {
                                parent = parent.parent;
                            }

                            if (parent) {
                                const symbolNamespace = parent.symbol;
                                if (symbolNamespace) {
                                    const valDeclNamespace = symbolNamespace.valueDeclaration;
                                    if (valDeclNamespace && valDeclNamespace.kind !== ts.SyntaxKind.SourceFile) {
                                        this.processType(valDeclNamespace);
                                        this.writer.writeString('::');
                                    }
                                }
                            }
                        }
                    }
                }

                if ((<any>typeReference.typeName).symbol
                    && (<any>typeReference.typeName).symbol.parent
                    && (<any>typeReference.typeName).symbol.parent.valueDeclaration.kind !== ts.SyntaxKind.SourceFile) {
                    this.processType((<any>typeReference.typeName).symbol.parent.valueDeclaration);
                    this.writer.writeString('::');
                }

                if (isArray) {
                    this.writer.writeString('array');
                } else if (isReadonly) {
                    this.writer.writeString('const ');
                } else {
                    this.writeTypeName(typeReference);
                }

                if (isReadonly) {
                    const element = typeReference.typeArguments[0];

                    this.processType(element, false, true);

                } else if (typeReference.typeArguments) {
                    this.writer.writeString('<');

                    let next1 = false;
                    typeReference.typeArguments.forEach(element => {
                        if (next1) {
                            this.writer.writeString(', ');
                        }

                        this.processType(element);
                        next1 = true;
                    });

                    this.writer.writeString('>');
                }

                if (!skipPointerIfA) {
                    this.writer.writeString('>');
                }

                break;
            case ts.SyntaxKind.TypeParameter:
                const typeParameter = <ts.TypeParameterDeclaration>type;
                if (typeParameter.name.kind === ts.SyntaxKind.Identifier) {
                    if (!noTypeName) {
                        this.writer.writeString('typename ');
                    }

                    this.writer.writeString(typeParameter.name.text);
                } else {
                    throw new Error('Not Implemented');
                }

                break;
            case ts.SyntaxKind.Parameter:
                const parameter = <ts.ParameterDeclaration>type;
                if (parameter.name.kind === ts.SyntaxKind.Identifier) {
                    this.processType(parameter.type);
                } else {
                    throw new Error('Not Implemented');
                }

                break;
            case ts.SyntaxKind.ConstructorType:
                const cfunctionType = <ts.FunctionTypeNode>type;
                this.writer.writeString('constructor_by_args<');
                this.processType(cfunctionType.type);
                if (cfunctionType.parameters) {
                    cfunctionType.parameters.forEach(element => {
                        this.writer.writeString(', ');
                        this.processType(element);
                    });
                }
                this.writer.writeString('>');
                if (isParam)
                    this.writer.writeString('&');
                break;
            case ts.SyntaxKind.FunctionType:

                const functionType = <ts.FunctionTypeNode>type;
                this.writer.writeString('std::function<');
                this.processType(functionType.type);
                this.writer.writeString('(');
                if (functionType.parameters) {
                    next = false;
                    functionType.parameters.forEach(element => {
                        if (next) {
                            this.writer.writeString(', ');
                        }

                        this.processType(element);
                        next = true;
                    });
                } else {
                    this.writer.writeString('void');
                }

                this.writer.writeString(')>');
                break;
            case ts.SyntaxKind.VoidKeyword:
                this.writer.writeString('void');
                break;
            case ts.SyntaxKind.AnyKeyword:
                this.writer.writeString('any');
                break;
            case ts.SyntaxKind.NullKeyword:
                this.writer.writeString('std::nullptr_t');
                break;
            case ts.SyntaxKind.UndefinedKeyword:
                this.writer.writeString('undefined_t');
                break;
            case ts.SyntaxKind.UnionType:

                /*
                const unionType = <ts.UnionTypeNode>type;
                const unionTypes = unionType.types
                    .filter(f => f.kind !== ts.SyntaxKind.NullKeyword && f.kind !== ts.SyntaxKind.UndefinedKeyword);

                if (this.typesAreNotSame(unionTypes)) {
                    const pos = type.pos >= 0 ? type.pos : 0;
                    const end = type.end >= 0 ? type.end : 0;
                    const unionName = `__union${pos}_${end}`;
                    if (implementingUnionType) {
                        this.writer.writeString('union ');
                        this.writer.writeString(unionName);
                        this.writer.writeString(' ');
                        this.writer.BeginBlock();

                        this.writer.writeStringNewLine(`${unionName}(std::nullptr_t v_) {}`);

                        unionTypes.forEach((element, i) => {
                            this.processType(element);
                            this.writer.writeString(` v${i}`);
                            this.writer.EndOfStatement();
                            this.writer.cancelNewLine();
                            this.writer.writeString(` ${unionName}(`);
                            this.processType(element);
                            this.writer.writeStringNewLine(` v_) : v${i}(v_) {}`);
                        });

                        this.writer.EndBlock();
                        this.writer.cancelNewLine();
                    } else {
                        this.writer.writeString(unionName);
                    }
                } else {
                    this.processType(unionTypes[0]);
                }
                */
                this.writer.writeString(auto ? 'auto' : 'any');

                break;
            case ts.SyntaxKind.ModuleDeclaration:
                if ((<any>type).symbol
                    && (<any>type).symbol.parent
                    && (<any>type).symbol.parent.valueDeclaration.kind !== ts.SyntaxKind.SourceFile) {
                    this.processType((<any>type).symbol.parent.valueDeclaration);
                    this.writer.writeString('::');
                }

                const moduleDeclaration = <ts.ModuleDeclaration><any>type;
                this.writer.writeString(moduleDeclaration.name.text);
                break;
            case ts.SyntaxKind.TypeQuery:
                const exprName = (<any>type).exprName;

                if ((<any>exprName).symbol
                    && (<any>exprName).symbol.parent
                    && (<any>exprName).symbol.parent.valueDeclaration.kind !== ts.SyntaxKind.SourceFile) {
                    this.processType((<any>exprName).symbol.parent.valueDeclaration);
                    this.writer.writeString('::');
                }

                this.writer.writeString(exprName.text);
                break;
            default:
                this.writer.writeString(auto ? 'auto' : 'any');
                break;
        }
    }

    private writeTypeName(typeReference: ts.TypeReferenceNode) {
        const entityProcess = (entity: ts.EntityName) => {
            if (entity.kind === ts.SyntaxKind.Identifier) {
                this.writer.writeString(entity.text);
            } else if (entity.kind === ts.SyntaxKind.QualifiedName) {
                entityProcess(entity.left);
                if (!this.resolver.isTypeFromSymbol(entity.left, ts.SyntaxKind.EnumDeclaration)) {
                    this.writer.writeString('::');
                    this.writer.writeString(entity.right.text);
                }
            } else {
                throw new Error('Not Implemented');
            }
        };

        entityProcess(typeReference.typeName);
    }

    private isEnum(typeReference: ts.TypeReferenceNode) {
        let isEnum = false;
        const entityProcessCheck = (entity: ts.EntityName) => {
            if (entity.kind === ts.SyntaxKind.QualifiedName) {
                entityProcessCheck(entity.left);
                isEnum = this.resolver.isTypeFromSymbol(entity.left, ts.SyntaxKind.EnumDeclaration);
            }
        };

        entityProcessCheck(typeReference.typeName);

        return isEnum;
    }

    private processDefaultValue(type: ts.TypeNode): void {
        switch (type.kind) {
            case ts.SyntaxKind.BooleanKeyword:
                this.writer.writeString('false');
                break;
            case ts.SyntaxKind.NumberKeyword:
                this.writer.writeString('0');
                break;
            case ts.SyntaxKind.StringKeyword:
                this.writer.writeString('STR("")');
                break;
            case ts.SyntaxKind.ArrayType:
                this.writer.writeString('{}');
                break;
            case ts.SyntaxKind.TupleType:
                const tupleType = <ts.TupleTypeNode>type;

                this.writer.writeString('{');

                let next = false;
                tupleType.elementTypes.forEach(element => {
                    if (next) {
                        this.writer.writeString(', ');
                    }

                    this.processDefaultValue(element);
                    next = true;
                });

                this.writer.writeString('}');
                break;
            case ts.SyntaxKind.TypeReference:
                this.writer.writeString('{}');
                break;
            default:
                this.writer.writeString('any');
                break;
        }
    }

    private processFunctionExpression(
        node: FuncExpr,
        implementationMode?: boolean): boolean {

        this.scope.push(node);
        const result = this.processFunctionExpressionInternal(node, implementationMode);
        this.scope.pop();

        return result;
    }


    private findReturnType(node: FuncExpr, things: FuncDefThings) {

        let inferredTp = node.type;
        let inferredTp0:ts.Type;

        /*if (!inferredTp && r && r.hasValue()) {
            inferredTp = 
                this.resolver.getOrResolveTypeOfAsTypeNode(r.returnStatement.expression);
            if (!inferredTp) {
                console.log("Could not infer return type way 1:"+node.getText()+"  ->  "+r.returnStatement.expression.getText());
            }
        }*/
            
        const tsTypeToCsingle = (type0: ts.Type) => {
            let tp = this.typeChecker.typeToString(type0);

            switch (tp) {
                case "true":
                case "false":
                case "boolean":
                    return 1;
                default:
                    if (/[+-]?\d+/.test(tp)) {
                        return 2;
                    } else if (/[+-]?\d*[.]\d+/.test(tp)) {
                        return 3;
                    } else if (/[+-]?\d*[.]?\d+[eE][+-]?\d+/.test(tp)) {
                        return 3;
                    } else {
                        return 0;
                    }
            }
        };

        const tsTypeToC = (tp: ts.Type) => {

            var numtypenames=[null,  "bool","int","double"]
            var maxch=0;
            var minch=100000000000;
            var utp=null;
            var itp=null;
            if (tp.isUnionOrIntersection() && tp.types) {
                
                tp.types.forEach(cht => {
                    let tpc = tsTypeToCsingle(cht);

                    if (tpc) {
                        if (tpc>maxch) {
                            maxch = tpc;
                            utp = numtypenames[tpc];
                        }
                        if (tpc<minch) {
                            minch = tpc;
                            itp = numtypenames[tpc];
                        }
                    } else {
                        maxch = 100000000000;
                        utp = null;
                    }
                });
            }
            if (tp.isUnion()) {
                return utp;
            } else if (tp.isIntersection()) {
                return itp;
            } else {
                let rtpc = tsTypeToCsingle(tp);
                return numtypenames[rtpc];
            }
        };
        if (!inferredTp) {
            try {
                let sign = this.typeChecker.getSignatureFromDeclaration(node);
                if (sign) {
                    inferredTp0 = this.typeChecker.getReturnTypeOfSignature(sign);
                    inferredTp = this.typeChecker.typeToTypeNode(inferredTp0);
                    /*if (!inferredTp) {
                        console.log("Could not infer return type:" + 
                        (node.name ? 
                        node.name.getText() : "noname : ")
                        +
                        (r && r.hasValue() ? " .. " + r.returnStatement.getText():"")
                        );
                    }*/
                } else {
                    /*console.log("Could not get signature metadata so infer return type:" + 
                    (node.name ? 
                    node.name.getText() : "noname : ")
                    +
                    (r && r.hasValue() ? " .. " + r.returnStatement.getText():"")
                    );*/
                }
            } catch(drop) {
                
            }
        }

        if (inferredTp) {
            //let typeInfo:ts.Type;
            //typeInfo = this.typeChecker.getTypeFromTypeNode(inferredTp);
            //!this.resolver.isAnyLikeType(typeInfo)
            // (ts.SyntaxKind[inferredTp.kind]);

            if (node.type && this.isTemplateType(inferredTp)) {
                return "RET";
            } else {
                if (!inferredTp0) {
                    inferredTp0 = this.typeChecker.getTypeFromTypeNode(inferredTp);
                }
                let r0 = tsTypeToC(inferredTp0);
                if (r0) {
                    return r0;
                } else if (things.isClassMember && (<ts.Identifier>node.name) && (<ts.Identifier>node.name).text && (<ts.Identifier>node.name).text === 'toString') {
                    return ('string');
                } else if (things.isClassMember && (<ts.Identifier>node.name) && (<ts.Identifier>node.name).text && (<ts.Identifier>node.name).text === 'length') {
                    return ('std::size_t');
                } else {
                    let ow = this.writer;
                    try {
                        this.writer = new CodeWriter();
                        this.processType(inferredTp);
                        return this.writer.getText();
                    } finally {
                        this.writer = ow;
                    }
                }
            }
        } else {
            if (things.noReturn) {
                return 'void';
            } else {
                if (things.isClassMember && (<ts.Identifier>node.name) && (<ts.Identifier>node.name).text && (<ts.Identifier>node.name).text === 'toString') {
                    return ('string');
                } else if (things.isClassMember && (<ts.Identifier>node.name) && (<ts.Identifier>node.name).text && (<ts.Identifier>node.name).text === 'length') {
                    return ('std::size_t');
                } else {
                    return ('any');
                }
            }
        }
    };


    private processFunctionExpressionInternal(
        node: FuncExpr,
        implementationMode?: boolean): boolean {

        if (implementationMode && this.isDeclare(node)) {
            return true;
        }

        // skip function declaration as union
        let noBody = false;
        if (!node.body
            || ((<any>node).body.statements
                && (<any>node).body.statements.length === 0
                && ((<any>node).body.statements).isMissingList)) {
            // function without body;
            if ((<any>node).nextContainer
                && node.kind === (<any>node).nextContainer.kind
                && (<any>node).name.text === (<any>node).nextContainer.name.text) {
                return true;
            }

            noBody = true;
        }

        const isAbstract = this.isAbstract(node)
            || (<any>node).kind === ts.SyntaxKind.MethodSignature && node.parent.kind === ts.SyntaxKind.InterfaceDeclaration;
        if (implementationMode && isAbstract) {
            // ignore declarations
            return true;
        }

        // const noParams = node.parameters.length === 0 && !this.hasArguments(node);
        // const noCapture = !this.requireCapture(node);

        // in case of nested function
        let things = new FuncDefThings(this, node);

        things.inferredReturnType = this.findReturnType(node, things);

        let uninferredConstructor = 
            node.kind === ts.SyntaxKind.Constructor && things.inferredReturnType==="void";

        let obsoleteConstructor = 
            node.kind === ts.SyntaxKind.Constructor && 
            this.wasCurClassConstructorInStack //&&
            //uninferredConstructor
            ;

        if (obsoleteConstructor) {

            if (implementationMode) return true;
 
            this.writer.writeStringNewLine('// base constructor : ');

            this.writer.writeString('// ');
        } else {
            if (node.kind === ts.SyntaxKind.Constructor)
                this.wasCurClassConstructorInStack = true;

            if (uninferredConstructor) {
                let ow = this.writer;
                try {
                    this.writer = new CodeWriter();
                    this.writeClassName();
                    things.inferredReturnType = "$S<"+this.writer.getText()+">";
                } finally {
                    this.writer = ow;
                }
            }
        }

        if (things.isNestedFunction) {
            implementationMode = true;
        }

        if (implementationMode && node.parent && node.parent.kind === ts.SyntaxKind.ClassDeclaration && this.isTemplate(<any>node.parent)) {
            this.processTemplateParams(<any>node.parent);
        }

        this.processTemplateParams(node);

        if (implementationMode !== true) {
            this.processModifiers(node.modifiers);
        }

        if (things.writeAsLambdaCFunction) {
            this.processFunctionExpressionLambda(node, things, implementationMode);
        }

        this.writer.writeString('(');

        this.processFunctionExpressionParameters(node, things, implementationMode);

        /*if (things.isArrowFunction || things.isFunctionExpression) {
            this.writer.writeStringNewLine(') mutable');
        } else {*/
            this.writer.writeStringNewLine(')');
        //}

        if (obsoleteConstructor) {
            this.writer.writeStringNewLine();
            return true;
        }

        let skipped = 0;
        if (node.kind === ts.SyntaxKind.Constructor && implementationMode) {
            skipped = this.processFunctionExpressionConstructor(node, things, implementationMode);
        }

        if (!implementationMode && isAbstract) {
            // abstract
            this.writer.cancelNewLine();
            this.writer.writeString(' = 0');
        }

        if (!noBody && (things.isArrowFunction || things.isFunctionExpression || implementationMode)) {
            this.writer.BeginBlock();

            node.parameters
                .filter(e => e.dotDotDotToken)
                .forEach(element => {
                    this.processType(element.type);
                    this.writer.writeString(' ');
                    this.processExpression(<ts.Identifier>element.name);
                    this.writer.writeString(' = ');
                    this.processType(element.type);
                    this.writer.writeString('{');
                    this.processExpression(<ts.Identifier>element.name);
                    this.writer.writeStringNewLine('_...};');
                });

            if (node.kind === ts.SyntaxKind.Constructor && this.hasThisAsShared(node)) {
                // adding header to constructor
                this.processType(this.resolver.getOrResolveTypeOfAsTypeNode(node.parent));
                this.writer.writeStringNewLine(' _this(this, [] (auto&) {/*to be finished*/});');
            }

            this.markRequiredCapture(node);
            (<any>node.body).statements.filter((item, index) => index >= skipped).forEach(element => {
                this.processStatementInternal(element, true);
            });

            // add default return if no body
            if (node.kind !== ts.SyntaxKind.Constructor && things.noReturnStatement && things.inferredReturnType != 'void') {
                this.writer.writeString('return ');
                this.writer.writeString(things.inferredReturnType);
                this.writer.writeString('()');
                this.writer.EndOfStatement();
            }

            this.writer.EndBlock();
        }

        if (node.kind === ts.SyntaxKind.Constructor && !implementationMode) {    
            this.writer.EndOfStatement();
            this.writer.writeStringNewLine();
            this.writer.writeStringNewLine("// T:"+things.inferredReturnType+" Args:"+things.functionArgs);
            this.writer.writeStringNewLine("typedef constructor_by_args<"+things.inferredReturnType+", "+things.functionArgs+"> constructor_type");
            this.writer.EndOfStatement();
            this.writer.writeStringNewLine("constexpr static constructor_type constructor_type_obj = constructor_type()");
            this.writer.EndOfStatement();
            this.writer.writeStringNewLine("virtual function& constructor() {");
            this.writer.writeStringNewLine("    return constructor_type_obj;");
            this.writer.writeStringNewLine("}");
            this.writer.writeStringNewLine();
            this.writer.writeStringNewLine();
        }


    }

    private processFunctionExpressionLambda(
        node: FuncExpr, things: FuncDefThings,
        implementationMode?: boolean) {

        if (things.isFunctionOrMethodDeclaration) {
            // type declaration
            if (node.kind !== ts.SyntaxKind.Constructor) {
                const isVirtual = things.isClassMember
                    && !this.isStatic(node)
                    && !this.isTemplate(<ts.MethodDeclaration>node)
                    && implementationMode !== true;
                if (isVirtual) {
                    this.writer.writeString('virtual ');
                }

                this.writer.writeString(things.inferredReturnType);

                this.writer.writeString(' ');
            }

            if (things.isClassMemberDeclaration && implementationMode) {
                // in case of constructor
                this.writeClassName();

                if (implementationMode
                    && node.parent
                    && node.parent.kind === ts.SyntaxKind.ClassDeclaration
                    && this.isTemplate(<any>node.parent)) {
                    this.processTemplateParameters(<any>node.parent);
                }

                this.writer.writeString('::');
            }

            // name
            if (node.name && node.name.kind === ts.SyntaxKind.Identifier) {
                if (node.kind === ts.SyntaxKind.GetAccessor) {
                    this.writer.writeString('get_');
                } else if (node.kind === ts.SyntaxKind.SetAccessor) {
                    this.writer.writeString('set_');
                }

                if (node.name.kind === ts.SyntaxKind.Identifier) {
                    this.processExpression(node.name);
                } else {
                    throw new Error('Not implemented');
                }
            } else {
                // in case of constructor
                this.writeClassName();
            }
        } else if (things.isArrowFunction || things.isFunctionExpression) {

            if (things.isNestedFunction) {
                this.writer.writeString('auto ');
                if (node.name.kind === ts.SyntaxKind.Identifier) {
                    this.processExpression(node.name);
                } else {
                    throw new Error('Not implemented');
                }

                this.writer.writeString(' = ');
            }

            // lambda or noname function
            //const byReference = (<any>node).__lambda_by_reference ? '&' : '=';
            //this.writer.writeString(`[${byReference}]`);
            this.writer.writeString(`[&]`);
        }
    }

    private processFunctionExpressionParameters(
        node: FuncExpr, things: FuncDefThings,
        implementationMode?: boolean) {

        let defaultParams = false;
        let next = false;
        node.parameters.forEach((element, index) => {
            if (next) {
                this.writer.writeString(', ');
                things.functionArgs += ', ';
            }

            if (element.name.kind !== ts.SyntaxKind.Identifier) {
                console.log("node parameter kind not implemented : ",element.name.getText()+" : "+ts.SyntaxKind[element.name.kind]);
                //throw new Error('Not implemented');
                this.writer.writeString('<not an identifier>');
                return;
            }


            const effectiveType = element.type
                || this.resolver.getOrResolveTypeOfAsTypeNode(element.initializer);
            if (element.dotDotDotToken) {
                this.writer.writeString('Args...');
                things.functionArgs += 'Args...';
            } else if (this.isTemplateType(effectiveType)) {
                this.writer.writeString('P' + index);
                things.functionArgs += 'P' + index;
            } else {
                let ow = this.writer;
                let arg = "";
                try {
                    this.writer = new CodeWriter();
                    this.processType(effectiveType, things.isArrowFunction, false, false, false, true);
                    arg = this.writer.getText();
                } finally {
                    this.writer = ow;
                }
                this.writer.writeString(arg);
                things.functionArgs += arg;
            }

            this.writer.writeString(' ');
            this.processExpression(element.name);

            // extra symbol to change parameter name
            if (node.kind === ts.SyntaxKind.Constructor
                && this.hasAccessModifier(element.modifiers)
                || element.dotDotDotToken) {
                this.writer.writeString('_');
            }

            if (!implementationMode) {
                if (element.initializer) {
                    this.writer.writeString(' = ');
                    this.processExpression(element.initializer);
                    defaultParams = true;
                } else if (element.questionToken || defaultParams) {
                    switch (element.type && element.type.kind) {
                        case ts.SyntaxKind.FunctionType:
                        case ts.SyntaxKind.ConstructorType:
                            this.writer.writeString(' = nullptr');
                            break;
                        default:
                            this.writer.writeString(' = undefined');
                            break;
                    }
                }
            }

            next = true;
        });
    
    }

    private processFunctionExpressionConstructor(
        node: ts.ConstructorDeclaration, things: FuncDefThings,
        implementationMode?: boolean): number {

        // constructor init
        let skipped = 0;

        this.writer.cancelNewLine();

        let next = false;
        node.parameters
            .filter(e => this.hasAccessModifier(e.modifiers))
            .forEach(element => {
                if (next) {
                    this.writer.writeString(', ');
                } else {
                    this.writer.writeString(' : ');
                }

                if (element.name.kind === ts.SyntaxKind.Identifier) {
                    this.processExpression(element.name);
                    this.writer.writeString('(');
                    this.processExpression(element.name);
                    this.writer.writeString('_)');
                } else {
                    throw new Error('Not implemented');
                }

                next = true;
            });

        // process base constructor call
        let superCall = (<any>node.body).statements[0];
        if (superCall && superCall.kind === ts.SyntaxKind.ExpressionStatement) {
            superCall = (<ts.ExpressionStatement>superCall).expression;
        }

        if (superCall && superCall.kind === ts.SyntaxKind.CallExpression
            && (<ts.CallExpression>superCall).expression.kind === ts.SyntaxKind.SuperKeyword) {
            if (!next) {
                this.writer.writeString(' : ');
            } else {
                this.writer.writeString(', ');
            }

            this.processExpression(superCall);
            skipped = 1;
        }

        if (next) {
            this.writer.writeString(' ');
        }

        this.writer.writeString(' ');
        return skipped;
    }

    private writeClassName() {
        const classNode = this.scope[this.scope.length - 2];
        if (classNode && classNode.kind === ts.SyntaxKind.ClassDeclaration) {
            this.processExpression((<ts.ClassDeclaration>classNode).name);
        } else {
            throw new Error('Not Implemented');
        }
    }

     private processTemplateParams(node: HasTemplate) {

        let types = <ts.TypeParameterDeclaration[]><any>node.typeParameters;
        if (types && node.parent && (<any>node.parent).typeParameters) {
            types = types.filter(t => (<any>node.parent).typeParameters.every(t2 => t.name.text !== t2.name.text));
        }

        const templateTypes = types && types.length > 0;
        const isParamTemplate = this.isMethodParamsTemplate(node);
        const isReturnTemplate = this.isTemplateType(node.type);

        let next = false;
        if (templateTypes || isParamTemplate || isReturnTemplate) {
            this.writer.writeString('template <');
            if (templateTypes) {
                types.forEach(type => {
                    if (next) {
                        this.writer.writeString(', ');
                    }

                    this.processType(type);
                    next = true;
                });
            }

            if (isReturnTemplate) {
                if (next) {
                    this.writer.writeString(', ');
                }

                this.writer.writeString('typename RET=void');
                next = true;
            }

            // add params
            if (isParamTemplate) {
                (<ts.MethodDeclaration>node).parameters.forEach((element, index) => {
                    if (this.isTemplateType(element.type)) {
                        if (next) {
                            this.writer.writeString(', ');
                        }

                        this.writer.writeString('typename P' + index);
                        next = true;
                    }

                    if (element.dotDotDotToken) {
                        this.writer.writeString('typename ...Args');
                        next = true;
                    }
                });
            }

            this.writer.writeStringNewLine('>');
        }

        return next;
    }

    private processTemplateParameters(node: ts.ClassDeclaration) {
        let next = false;
        if (node.typeParameters) {
            this.writer.writeString('<');
            node.typeParameters.forEach(type => {
                if (next) {
                    this.writer.writeString(', ');
                }
                this.processType(type, undefined, undefined, true);
                next = true;
            });
            this.writer.writeString('>');
        }

        return next;
    }

    private processTemplateArguments(node: ts.ExpressionWithTypeArguments | ts.CallExpression | ts.NewExpression,
        skipPointerInType?: boolean) {
        let next = false;
        if (node.typeArguments) {
            this.writer.writeString('<');
            node.typeArguments.forEach(element => {
                if (next) {
                    this.writer.writeString(', ');
                }

                this.processType(element, undefined, skipPointerInType);
                next = true;
            });
            this.writer.writeString('>');
        } else {
            /*
            const typeInfo = this.resolver.getOrResolveTypeOf(node.expression);
            const templateParametersInfoFromType: ts.TypeParameter[] = typeInfo
                && typeInfo.symbol
                && typeInfo.symbol.valueDeclaration
                && (<any>typeInfo.symbol.valueDeclaration).typeParameters;

            if (templateParametersInfoFromType) {
                this.writer.writeString('<void>');
            }
            */
        }
    }

    private processArrowFunction(node: ts.ArrowFunction): void {
        if (node.body.kind !== ts.SyntaxKind.Block) {
            // create body
            node.body = ts.createBlock([ts.createReturn(<ts.Expression>node.body)]);
        }

        this.processFunctionExpression(<any>node);
    }

    isClassMemberDeclaration(node: ts.Node) {
        if (!node) {
            return false;
        }

        return node.kind === ts.SyntaxKind.Constructor
            || node.kind === ts.SyntaxKind.MethodDeclaration
            || node.kind === ts.SyntaxKind.PropertyDeclaration
            || node.kind === ts.SyntaxKind.GetAccessor
            || node.kind === ts.SyntaxKind.SetAccessor;
    }

    isClassMemberSignature(node: ts.Node) {
        if (!node) {
            return false;
        }

        return node.kind === ts.SyntaxKind.MethodSignature
            || node.kind === ts.SyntaxKind.PropertySignature;
    }

    private isStatic(node: ts.Node) {
        return node.modifiers && node.modifiers.some(m => m.kind === ts.SyntaxKind.StaticKeyword);
    }

    private isAbstract(node: ts.Node) {
        return node.modifiers && node.modifiers.some(m => m.kind === ts.SyntaxKind.AbstractKeyword);
    }

    private isDeclare(node: ts.Node) {
        return node.modifiers && node.modifiers.some(m => m.kind === ts.SyntaxKind.DeclareKeyword);
    }

    private processFunctionDeclaration(node: ts.FunctionDeclaration | ts.MethodDeclaration, implementationMode?: boolean): boolean {

        if (!implementationMode) {
            this.processPredefineType(node.type);
            node.parameters.forEach((element) => {
                this.processPredefineType(element.type);
            });
        }

        const skip = this.processFunctionExpression(<ts.FunctionExpression><any>node, implementationMode);
        if (!skip && !this.isClassMemberDeclaration(node)) {
            this.writer.EndOfStatement();
            if (!this.isClassMemberSignature(node)) {
                this.writer.writeStringNewLine();
            }
        }

        return skip;
    }

    private processReturnStatement(node: ts.ReturnStatement): void {
        const typeReturn = this.resolver.getOrResolveTypeOfAsTypeNode(node.expression);
        const functionDeclaration = (<ts.FunctionDeclaration>(this.scope[this.scope.length - 1]));
        let functionReturn = functionDeclaration.type || this.resolver.getOrResolveTypeOfAsTypeNode(functionDeclaration);
        if (!functionReturn) {
        } else if (functionReturn.kind === ts.SyntaxKind.FunctionType) {
            functionReturn = (<ts.FunctionTypeNode>functionReturn).type;
        } else if (functionReturn.kind === ts.SyntaxKind.ConstructorType) {
            functionReturn = (<ts.FunctionTypeNode>functionReturn).type;
        } else if (!functionDeclaration.type) {
            // if it is not function then use "any"
            functionReturn = null;
        }

        this.writer.writeString('return');
        if (node.expression) {
            this.writer.writeString(' ');

            /*
            let theSame = (typeReturn && typeReturn.kind === ts.SyntaxKind.ThisKeyword)
                || this.resolver.typesAreTheSame(typeReturn, functionReturn);

            // TODO: hack
            if (typeReturn && typeReturn.kind === ts.SyntaxKind.ArrayType) {
                theSame = false;
            }

            // cast only if we have provided type
            if (!theSame && functionReturn) {
                this.writer.writeString('cast<');

                if (this.isTemplateType(functionReturn)) {
                    this.writer.writeString('RET');
                } else {
                    this.processType(functionReturn);
                }

                this.writer.writeString('>(');
            }
            */

            this.processExpression(node.expression);

            /*
            if (!theSame && functionReturn) {
                this.writer.writeString(')');
            }
            */
        } else {
            if (functionReturn && functionReturn.kind !== ts.SyntaxKind.VoidKeyword) {
                this.writer.writeString(' ');
                this.processType(functionReturn);
                this.writer.writeString('()');
            }
        }

        this.writer.EndOfStatement();
    }

    private processIfStatement(node: ts.IfStatement): void {
        this.writer.writeString('if (');
        this.processExpression(node.expression);
        this.writer.writeString(') ');

        this.processStatement(node.thenStatement);

        if (node.elseStatement) {
            this.writer.cancelNewLine();
            this.writer.writeString(' else ');
            this.processStatement(node.elseStatement);
        }
    }

    private processDoStatement(node: ts.DoStatement): void {
        this.writer.writeStringNewLine('do');
        this.processStatement(node.statement);
        this.writer.writeString('while (');
        this.processExpression(node.expression);
        this.writer.writeStringNewLine(');');
    }

    private processWhileStatement(node: ts.WhileStatement): void {
        this.writer.writeString('while (');
        this.processExpression(node.expression);
        this.writer.writeStringNewLine(')');
        this.processStatement(node.statement);
    }

    private processForStatement(node: ts.ForStatement): void {
        this.writer.writeString('for (');
        const initVar = <any>node.initializer;
        this.processExpression(initVar);
        this.writer.writeString('; ');
        this.processExpression(node.condition);
        this.writer.writeString('; ');
        this.processExpression(node.incrementor);
        this.writer.writeStringNewLine(')');
        this.processStatement(node.statement);
    }

    private processForInStatement(node: ts.ForInStatement): void {
        this.processForInStatementNoScope(node);
    }

    private processForInStatementNoScope(node: ts.ForInStatement): void {
        this.writer.writeString('for (auto& ');
        const initVar = <any>node.initializer;
        initVar.__ignore_type = true;
        this.processExpression(initVar);
        this.writer.writeString(' : keys_(');
        this.processExpression(node.expression);
        this.writer.writeStringNewLine('))');
        this.processStatement(node.statement);
    }

    private processForOfStatement(node: ts.ForOfStatement): void {

        // if has Length access use iteration
        const hasLengthAccess = this.hasPropertyAccess(node.statement, 'length');
        if (!hasLengthAccess) {
            this.writer.writeString('for (auto& ');
            const initVar = <any>node.initializer;
            initVar.__ignore_type = true;
            this.processExpression(initVar);

            this.writer.writeString(' : ');

            this.processExpression(node.expression);

            this.writer.writeStringNewLine(')');
            this.processStatement(node.statement);
        } else {
            const arrayName = `__array${node.getFullStart()}_${node.getEnd()}`;
            const indexName = `__indx${node.getFullStart()}_${node.getEnd()}`;
            this.writer.writeString(`auto& ${arrayName} = `);
            this.processExpression(node.expression);
            this.writer.EndOfStatement();

            this.writer.writeStringNewLine(`for (auto ${indexName} = 0_N; ${indexName} < ${arrayName}->get_length(); ${indexName}++)`);
            this.writer.BeginBlock();
            this.writer.writeString(`auto& `);
            const initVar = <any>node.initializer;
            initVar.__ignore_type = true;
            this.processExpression(initVar);
            this.writer.writeStringNewLine(` = const_(${arrayName})[${indexName}]`);
            this.writer.EndOfStatement();

            this.processStatement(node.statement);
            this.writer.EndBlock();
        }
    }

    private processBreakStatement(node: ts.BreakStatement) {
        this.writer.writeStringNewLine('break;');
    }

    private processContinueStatement(node: ts.ContinueStatement) {
        this.writer.writeStringNewLine('continue;');
    }

    private processSwitchStatement(node: ts.SwitchStatement) {
        const caseExpressions = node.caseBlock.clauses
            .filter(c => c.kind === ts.SyntaxKind.CaseClause)
            .map(element => (<ts.CaseClause>element).expression);

        if (!caseExpressions || caseExpressions.length === 0) {
            this.processSwitchStatementForBasicTypesInternal(node);
            return;
        }

        const isAllStatic = caseExpressions
            .every(expression => expression.kind === ts.SyntaxKind.NumericLiteral
                || expression.kind === ts.SyntaxKind.StringLiteral
                || expression.kind === ts.SyntaxKind.TrueKeyword
                || expression.kind === ts.SyntaxKind.FalseKeyword
                || this.resolver.isTypeFromSymbol(this.resolver.getOrResolveTypeOf(expression), ts.SyntaxKind.EnumMember));

        const firstExpression = caseExpressions[0];
        const firstType = this.resolver.getOrResolveTypeOf(firstExpression);
        const firstTypeNode = this.resolver.typeToTypeNode(firstType);
        const isTheSameTypes = caseExpressions.every(
            ce => this.resolver.typesAreTheSame(this.resolver.getOrResolveTypeOfAsTypeNode(ce), firstTypeNode));

        if (isTheSameTypes && isAllStatic && !this.resolver.isStringType(firstType)) {
            this.processSwitchStatementForBasicTypesInternal(node);
            return;
        }

        this.processSwitchStatementForAnyInternal(node);
    }

    private processSwitchStatementForBasicTypesInternal(node: ts.SwitchStatement) {
        const caseExpressions = node.caseBlock.clauses
            .filter(c => c.kind === ts.SyntaxKind.CaseClause)
            .map(element => (<ts.CaseClause>element).expression);

        const isNumeric = this.resolver.isNumberType(this.resolver.getOrResolveTypeOf(node.expression));
        const isInteger = caseExpressions.every(expression => expression.kind === ts.SyntaxKind.NumericLiteral
            && this.isInt((<ts.NumericLiteral>expression).text));

        this.writer.writeString(`switch (`);

        if (isInteger && isNumeric) {
            this.writer.writeString(`static_cast<size_t>(`);
        }

        this.processExpression(node.expression);

        if (isInteger && isNumeric) {
            this.writer.writeString(`)`);
        }

        this.writer.writeStringNewLine(')');

        this.writer.BeginBlock();

        node.caseBlock.clauses.forEach(element => {
            this.writer.DecreaseIntent();
            if (element.kind === ts.SyntaxKind.CaseClause) {
                this.writer.writeString(`case `);
                (<any>element.expression).__skip_boxing = true;
                this.processExpression(element.expression);
            } else {
                this.writer.writeString('default');
            }

            this.writer.IncreaseIntent();

            this.writer.writeStringNewLine(':');
            element.statements.forEach(elementCase => {
                this.processStatement(elementCase);
            });
        });

        this.writer.EndBlock();
    }

    private processSwitchStatementForAnyInternal(node: ts.SwitchStatement) {

        const switchName = `__switch${node.getFullStart()}_${node.getEnd()}`;
        const isAllStatic = node.caseBlock.clauses
            .filter(c => c.kind === ts.SyntaxKind.CaseClause)
            .map(element => (<ts.CaseClause>element).expression)
            .every(expression => expression.kind === ts.SyntaxKind.NumericLiteral
                || expression.kind === ts.SyntaxKind.StringLiteral
                || expression.kind === ts.SyntaxKind.TrueKeyword
                || expression.kind === ts.SyntaxKind.FalseKeyword);

        if (isAllStatic) {
            this.writer.writeString('static ');
        }

        this.writer.writeString(`switch_type ${switchName} = `);
        this.writer.BeginBlock();

        let caseNumber = 0;
        node.caseBlock.clauses.filter(c => c.kind === ts.SyntaxKind.CaseClause).forEach(element => {
            if (caseNumber > 0) {
                this.writer.writeStringNewLine(',');
            }

            this.writer.BeginBlockNoIntent();
            this.writer.writeString('any(');
            this.processExpression((<ts.CaseClause>element).expression);
            this.writer.writeString('), ');
            this.writer.writeString((++caseNumber).toString());
            this.writer.EndBlockNoIntent();
        });

        this.writer.EndBlock();
        this.writer.EndOfStatement();


        this.writer.writeString(`switch (${switchName}[`);
        this.processExpression(node.expression);
        this.writer.writeStringNewLine('])');

        this.writer.BeginBlock();

        caseNumber = 0;
        node.caseBlock.clauses.forEach(element => {
            this.writer.DecreaseIntent();
            if (element.kind === ts.SyntaxKind.CaseClause) {
                this.writer.writeString(`case ${++caseNumber}`);
            } else {
                this.writer.writeString('default');
            }

            this.writer.IncreaseIntent();

            this.writer.writeStringNewLine(':');
            element.statements.forEach(elementCase => {
                this.processStatement(elementCase);
            });
        });

        this.writer.EndBlock();
    }

    private processBlock(node: ts.Block): void {
        this.writer.BeginBlock();

        node.statements.forEach(element => {
            this.processStatement(element);
        });

        this.writer.EndBlock();
    }

    private processModuleBlock(node: ts.ModuleBlock): void {
        node.statements.forEach(s => {
            this.processStatement(s);
        });
    }

    private processBooleanLiteral(node: ts.BooleanLiteral): void {
        // find if you need to box value
        const boxing = (<any>node).__boxing;
        this.writer.writeString(`${node.kind === ts.SyntaxKind.TrueKeyword ? ('true' + (boxing ? '_t' : '')) : ('false' + (boxing ? '_t' : ''))}`);
    }

    private processNullLiteral(node: ts.NullLiteral): void {
        this.writer.writeString(node && node.parent.kind === ts.SyntaxKind.TypeAssertionExpression ? 'nullptr' : 'null');
    }

    private isInt(valAsString: string) {
        const val = parseInt(valAsString, 10);
        return val.toString() === valAsString;
    }

    private processNumericLiteral(node: ts.NumericLiteral): void {
        const boxing = (<any>node).__boxing;
        const val = parseInt(node.text, 10);
        const isInt = val.toString() === node.text;
        const isNegative = node.parent
            && node.parent.kind === ts.SyntaxKind.PrefixUnaryExpression
            && (<ts.PrefixUnaryExpression>node.parent).operator === ts.SyntaxKind.MinusToken;
        let suffix = '';
        if (isInt && val >= 2147483648) {
            suffix = 'll';
        }

        // find if you need to box value
        let currentNode: ts.Expression = node;
        if (isNegative) {
            currentNode = <ts.Expression>currentNode.parent;
        }

        while (currentNode && currentNode.parent && currentNode.parent.kind === ts.SyntaxKind.ParenthesizedExpression) {
            currentNode = <ts.Expression>currentNode.parent;
        }

        this.writer.writeString(`${node.text}`);
        if (boxing) {
            this.writer.writeString(`_N`);
        } else {
            this.writer.writeString(`${suffix}`);
        }
    }

    private processStringLiteral(node: ts.StringLiteral | ts.LiteralLikeNode
        | ts.TemplateHead | ts.TemplateMiddle | ts.TemplateTail): void {
        const text = node.text.replace(/\n/g, '\\\n');
        if (text === '') {
            this.writer.writeString(`string_empty`);
        } else {
            let esctext = JSON.stringify(text).slice(1, -1);
            this.writer.writeString(`STR("${esctext}")`);
        }
    }

    private processNoSubstitutionTemplateLiteral(node: ts.NoSubstitutionTemplateLiteral): void {
        this.processStringLiteral(<ts.StringLiteral><any>node);
    }

    private processTemplateExpression(node: ts.TemplateExpression): void {
        this.processStringLiteral(node.head);
        node.templateSpans.forEach(element => {
            this.writer.writeString(' + ');
            if (element.expression.kind === ts.SyntaxKind.BinaryExpression) {
                this.writer.writeString('(');
            }

            this.processExpression(element.expression);

            if (element.expression.kind === ts.SyntaxKind.BinaryExpression) {
                this.writer.writeString(')');
            }

            this.writer.writeString(' + ');
            this.processStringLiteral(element.literal);
        });
    }

    private processRegularExpressionLiteral(node: ts.RegularExpressionLiteral): void {
        this.writer.writeString('(new RegExp(');
        this.processStringLiteral(<ts.LiteralLikeNode>{ text: node.text.substring(1, node.text.length - 2) });
        this.writer.writeString('))');
    }

    private processObjectLiteralExpression(node: ts.ObjectLiteralExpression): void {
        let next = false;

        const hasSpreadAssignment = node.properties.some(e => e.kind === ts.SyntaxKind.SpreadAssignment);

        if (hasSpreadAssignment) {
            this.writer.writeString('(utils::assign(');
            this.writer.writeString('new object()');
        } else {
            this.writer.writeString('(new object(');
        }

        if (node.properties.length !== 0) {
            this.writer.BeginBlock();
            node.properties.forEach(element => {
                if (next && element.kind !== ts.SyntaxKind.SpreadAssignment) {
                    this.writer.writeStringNewLine(', ');
                }

                if (element.kind === ts.SyntaxKind.PropertyAssignment) {
                    const property = <ts.PropertyAssignment>element;

                    this.writer.writeString('object::pair{');

                    if (property.name
                        && (property.name.kind === ts.SyntaxKind.Identifier
                            || property.name.kind === ts.SyntaxKind.NumericLiteral)) {
                        this.processExpression(ts.createStringLiteral(property.name.text));
                    } else {
                        this.processExpression(<ts.Expression>property.name);
                    }

                    this.writer.writeString(', ');
                    this.processExpression(property.initializer);
                    this.writer.writeString('}');
                } else if (element.kind === ts.SyntaxKind.ShorthandPropertyAssignment) {
                    const property = <ts.ShorthandPropertyAssignment>element;

                    this.writer.writeString('object::pair{');

                    if (property.name
                        && (property.name.kind === ts.SyntaxKind.Identifier
                            || property.name.kind === ts.SyntaxKind.NumericLiteral)) {
                        this.processExpression(ts.createStringLiteral(property.name.text));
                    } else {
                        this.processExpression(<ts.Expression>property.name);
                    }

                    this.writer.writeString(', ');
                    if (property.name
                        && (property.name.kind === ts.SyntaxKind.Identifier
                            || property.name.kind === ts.SyntaxKind.NumericLiteral)) {
                        this.processExpression(ts.createStringLiteral(property.name.text));
                    } else {
                        this.processExpression(<ts.Expression>property.name);
                    }

                    this.writer.writeString('}');
                }

                next = true;
            });

            this.writer.EndBlock(true);
        }

        if (hasSpreadAssignment) {
            node.properties.forEach(element => {
                if (element.kind === ts.SyntaxKind.SpreadAssignment) {
                    this.writer.writeString(', ');
                    const spreadAssignment = <ts.SpreadAssignment>element;
                    this.processExpression(spreadAssignment.expression);
                }
            });
        }
        this.writer.writeString('))->shared_from_this()');
    }

    private processComputedPropertyName(node: ts.ComputedPropertyName): void {
        this.processExpression(node.expression);
    }

    private processArrayLiteralExpression(node: ts.ArrayLiteralExpression): void {
        let next = false;

        const isDeconstruct = node.parent && node.parent.kind === ts.SyntaxKind.BinaryExpression
            && (<ts.BinaryExpression>node.parent).left === node;
        let isTuple = false;
        const type = this.resolver.typeToTypeNode(this.resolver.getOrResolveTypeOf(node));
        if (type.kind === ts.SyntaxKind.TupleType) {
            isTuple = true;
        }

        let elementsType = (<any>node).parent.type;
        if (!elementsType) {
            if (node.elements.length !== 0) {
                elementsType = this.resolver.typeToTypeNode(this.resolver.getTypeAtLocation(node.elements[0]));
            }
        } else {
            if (elementsType.elementType) {
                elementsType = elementsType.elementType;
            } else if (elementsType.typeArguments && elementsType.typeArguments[0]) {
                elementsType = elementsType.typeArguments[0];
            }
        }

        if (isDeconstruct) {
            this.writer.writeString('std::tie(');
            node.elements.forEach(element => {
                if (next) {
                    this.writer.writeString(', ');
                }

                this.processExpression(element);

                next = true;
            });

            this.writer.writeString(')');
            return;
        }

        this.writer.writeString('(new ');
        if (!isTuple) {
            this.writer.writeString('array<');
            if (elementsType) {
                this.processType(elementsType);
            } else {
                this.writer.writeString('any');
            }

            this.writer.writeString('>');
        } else {
            this.processType(type);
        }

        if (node.elements.length !== 0) {
            this.writer.BeginBlockNoIntent();
            node.elements.forEach(element => {
                if (next) {
                    this.writer.writeString(', ');
                }

                this.processExpression(element);

                next = true;
            });

            this.writer.EndBlockNoIntent();
        } else {
            this.writer.writeString('()');
        }
        this.writer.writeString(')->shared_from_this()');
    }

    private processElementAccessExpression(node: ts.ElementAccessExpression): void {

        //const symbolInfo = this.resolver.getSymbolAtLocation(node.expression);
        const typeInfo = this.resolver.getOrResolveTypeOf(node.expression);
        const type = this.resolver.typeToTypeNode(typeInfo);
        if (type && type.kind === ts.SyntaxKind.TupleType) {
            // tuple
            if (node.argumentExpression.kind !== ts.SyntaxKind.NumericLiteral) {
                throw new Error('Not implemented');
            }

            this.writer.writeString('std::get<');
            (<any>node.argumentExpression).__skip_boxing = true;
            this.processExpression(node.argumentExpression);
            this.writer.writeString('>(');
            this.processExpression(node.expression);
            this.writer.writeString(')');
        } else {

            /*dereference = type
                && type.kind !== ts.SyntaxKind.TypeLiteral
                && type.kind !== ts.SyntaxKind.StringKeyword
                && type.kind !== ts.SyntaxKind.ArrayType
                && type.kind !== ts.SyntaxKind.ObjectKeyword
                && type.kind !== ts.SyntaxKind.AnyKeyword
                && symbolInfo
                && symbolInfo.valueDeclaration
                && (!(<ts.ParameterDeclaration>symbolInfo.valueDeclaration).dotDotDotToken)
                && (<any>symbolInfo.valueDeclaration).initializer
                && (<any>symbolInfo.valueDeclaration).initializer.kind !== ts.SyntaxKind.ObjectLiteralExpression;
            */
            let isEnum = false;
            let isWriting = false;
            let isTypeId = type
                && type.kind === ts.SyntaxKind.TypeQuery;

            if (isTypeId) {
                isEnum = this.resolver.isTypeFromSymbol(typeInfo, ts.SyntaxKind.EnumDeclaration);
                if (isEnum) {
                    this.writer.writeString('Enum_');
                }
            } else {
                this.writer.writeString('(*');
                isWriting = this.isWritingExpression(node);

                if (!isWriting) {
                    this.writer.writeString('const_(');
                }
            }

            this.processExpression(node.expression);

            if (!isTypeId) {

                if (!isWriting) {
                    this.writer.writeString(')');
                }

                this.writer.writeString(')');
            }

            if (isEnum) {
                this.writer.writeString('::name(');
                this.processExpression(node.argumentExpression);
                this.writer.writeString(')');
            } else {
                let name:string;
                let ow = this.writer;
                try {
                    this.writer = new CodeWriter();
                    this.processExpression(node.argumentExpression);
                    name = this.writer.getText();
                } finally {
                    this.writer = ow;
                }
                if (name === 'STR("__proto")') {
                    this.writer.writeString(".constructor()");
                } else {
                    this.writer.writeString('[');
                    this.writer.writeString(name);
                    this.writer.writeString(']');
                }
    
            }
        }
    }

    private isWritingExpression(node: ts.Expression): boolean {

        let isWriting = false;

        switch (node.parent.kind) {
            case ts.SyntaxKind.BinaryExpression: {
                const binaryExpression = <ts.BinaryExpression>node.parent;
                switch (binaryExpression.operatorToken.kind) {
                    case ts.SyntaxKind.EqualsToken:
                    case ts.SyntaxKind.BarEqualsToken:
                    case ts.SyntaxKind.PlusEqualsToken:
                    case ts.SyntaxKind.CaretEqualsToken:
                    case ts.SyntaxKind.MinusEqualsToken:
                    case ts.SyntaxKind.SlashEqualsToken:
                    case ts.SyntaxKind.PercentEqualsToken:
                    case ts.SyntaxKind.AsteriskEqualsToken:
                    case ts.SyntaxKind.AmpersandEqualsToken:
                    case ts.SyntaxKind.AsteriskAsteriskEqualsToken:
                        isWriting = binaryExpression.left === node;
                        break;
                }
                break;
            }
            case ts.SyntaxKind.PrefixUnaryExpression: 
            case ts.SyntaxKind.PostfixUnaryExpression: {
                const unaryExpression = <ts.PrefixUnaryExpression|ts.PostfixUnaryExpression>node.parent;
                switch (unaryExpression.operator) {
                    case ts.SyntaxKind.PlusPlusToken:
                    case ts.SyntaxKind.MinusMinusToken:
                        isWriting = true;
                        break;
                }
                break;
            }
        }
        return isWriting;
    }

    private processParenthesizedExpression(node: ts.ParenthesizedExpression) {
        this.writer.writeString('(');
        this.processExpression(node.expression);
        this.writer.writeString(')');
    }

    private processTypeAssertionExpression(node: ts.TypeAssertion) {
        this.writer.writeString('static_cast<');
        this.processType(node.type);
        this.writer.writeString('>(');
        this.processExpression(node.expression);
        this.writer.writeString(')');
    }

    private processPrefixUnaryExpression(node: ts.PrefixUnaryExpression): void {

        const typeInfo = this.resolver.getOrResolveTypeOf(node.operand);
        const isEnum = this.resolver.isTypeFromSymbol(typeInfo, ts.SyntaxKind.EnumDeclaration);

        const op = this.opsMap[node.operator];
        const isFunction = op.substr(0, 2) === '__';
        if (isFunction) {
            this.writer.writeString(op.substr(2) + '(');
        } else {
            this.writer.writeString(op);
        }

        if (isEnum) {
            this.writer.writeString('js::number(');
        }

        this.processExpression(node.operand);

        if (isEnum) {
            this.writer.writeString(')');
        }

        if (isFunction) {
            this.writer.writeString(')');
        }
    }

    private processPostfixUnaryExpression(node: ts.PostfixUnaryExpression): void {
        this.processExpression(node.operand);
        this.writer.writeString(this.opsMap[node.operator]);
    }

    private processConditionalExpression(node: ts.ConditionalExpression): void {

        const whenTrueType = this.resolver.getOrResolveTypeOfAsTypeNode(node.whenTrue);
        const whenFalseType = this.resolver.getOrResolveTypeOfAsTypeNode(node.whenFalse);
        const equals = this.compareTypes(whenTrueType, whenFalseType);

        this.writer.writeString('(');
        this.processExpression(node.condition);
        this.writer.writeString(') ? ');
        if (!equals) {
            this.writer.writeString('any(');
        }

        this.processExpression(node.whenTrue);
        if (!equals) {
            this.writer.writeString(')');
        }

        this.writer.writeString(' : ');
        if (!equals) {
            this.writer.writeString('any(');
        }

        this.processExpression(node.whenFalse);
        if (!equals) {
            this.writer.writeString(')');
        }
    }

    private processBinaryExpression(node: ts.BinaryExpression): void {
        const opCode = node.operatorToken.kind;
        if (opCode === ts.SyntaxKind.InstanceOfKeyword) {
            this.writer.writeString('$is<');

            if (node.right.kind === ts.SyntaxKind.Identifier) {
                const identifier = <ts.Identifier>node.right;
                switch (identifier.text) {
                    case 'Number':
                    case 'String':
                    case 'Boolean':
                        this.writer.writeString('js::');
                        this.writer.writeString(identifier.text.toLocaleLowerCase());
                        break;
                    default:
                        this.processExpression(node.right);
                        break;
                }
            } else {
                this.processExpression(node.right);
            }

            this.writer.writeString('>(');
            this.processExpression(node.left);
            this.writer.writeString(')');
            return;
        }

        const wrapIntoRoundBrackets =
            opCode === ts.SyntaxKind.AmpersandAmpersandToken
            || opCode === ts.SyntaxKind.BarBarToken;
        const op = this.opsMap[node.operatorToken.kind];
        const isFunction = op.substr(0, 2) === '__';
        if (isFunction) {
            this.writer.writeString(op.substr(2) + '(');
        }

        const leftType = this.resolver.getOrResolveTypeOf(node.left);
        const rightType = this.resolver.getOrResolveTypeOf(node.right);

        const isLeftEnum = this.resolver.isTypeFromSymbol(leftType, ts.SyntaxKind.EnumDeclaration)
        const isRightEnum = this.resolver.isTypeFromSymbol(rightType, ts.SyntaxKind.EnumDeclaration)

        const leftSouldBePointer = isLeftEnum &&
            (opCode === ts.SyntaxKind.EqualsToken
            || opCode === ts.SyntaxKind.AmpersandToken
            || opCode === ts.SyntaxKind.BarEqualsToken
            || opCode === ts.SyntaxKind.CaretEqualsToken
            || opCode === ts.SyntaxKind.PercentEqualsToken)

        if (wrapIntoRoundBrackets) {
            this.writer.writeString('(');
        }

        if (isLeftEnum) {
            if (leftSouldBePointer) {
                this.writer.writeString('*reinterpret_cast<long*>(&');
            } else {
                this.writer.writeString('static_cast<long>(');
            }
        }

        this.processExpression(node.left);

        if (isLeftEnum) {
            this.writer.writeString(')');
        }

        if (wrapIntoRoundBrackets) {
            this.writer.writeString(')');
        }

        if (isFunction) {
            this.writer.writeString(', ');
        } else {
            this.writer.writeString(' ' + op + ' ');
        }

        if (wrapIntoRoundBrackets) {
            this.writer.writeString('(');
        }

        if (isRightEnum) {
            this.writer.writeString('static_cast<long>(');
        }

        this.processExpression(node.right);

        if (isRightEnum) {
            this.writer.writeString(')');
        }

        if (wrapIntoRoundBrackets) {
            this.writer.writeString(')');
        }

        if (isFunction) {
            this.writer.writeString(')');
        }
    }

    private processDeleteExpression(node: ts.DeleteExpression): void {
        if (node.expression.kind === ts.SyntaxKind.PropertyAccessExpression) {
            const propertyAccess = <ts.PropertyAccessExpression>node.expression;
            this.processExpression(propertyAccess.expression);
            this.writer.writeString('.Delete("');
            this.processExpression(<ts.Identifier>propertyAccess.name);
            this.writer.writeString('")');
        } else if (node.expression.kind === ts.SyntaxKind.ElementAccessExpression) {
            const elementAccessExpression = <ts.ElementAccessExpression>node.expression;
            this.processExpression(elementAccessExpression.expression);
            this.writer.writeString('.Delete(');
            this.processExpression(elementAccessExpression.argumentExpression);
            this.writer.writeString(')');
        } else {
            throw new Error('Method not implemented.');
        }
    }

    private processNewExpression(node: ts.NewExpression): void {
        if (node.parent.kind === ts.SyntaxKind.PropertyAccessExpression) {
            this.writer.writeString('(');
        }

        this.processCallExpression(node);

        if (node.parent.kind === ts.SyntaxKind.PropertyAccessExpression) {
            this.writer.writeString(')');
        }
    }

    private processCallExpression(node: ts.CallExpression | ts.NewExpression): void {

        const isNew = node.kind === ts.SyntaxKind.NewExpression;
        const typeOfExpression = isNew && this.resolver.getOrResolveTypeOf(node.expression);
        const isArray = isNew && typeOfExpression && typeOfExpression.symbol && typeOfExpression.symbol.name === 'ArrayConstructor';

        this.isInvokableClassRefInStack = false;
        let invclassref = false;

        if (isArray) {
            this.writer.writeString('std::make_shared<');
            this.writer.writeString('array');
        } else {

            let name:string;
            let ow = this.writer;
            try {
                this.writer = new CodeWriter();
                this.isNewExpressionInStack = true;

                this.processExpression(node.expression);
                name = this.writer.getText();
            } finally {
                invclassref = this.isInvokableClassRefInStack;
                this.writer = ow;
                this.isNewExpressionInStack = false;
                this.isInvokableClassRefInStack = false;
            }
            if (isNew && !invclassref) {
                this.writer.writeString('std::make_shared<');
            }
            
            this.writer.writeString(name);


            this.processTemplateArguments(node);
        }

        if (isArray || (isNew && !invclassref)) {
            // closing template
            this.writer.writeString('>');
        }

        this.writer.writeString('(');

        let next = false;
        if (node.arguments.length) {
            node.arguments.forEach(element => {
                if (next) {
                    this.writer.writeString(', ');
                }

                this.processExpression(element);
                next = true;
            });
        }

        this.writer.writeString(')');
    }

    private processThisExpression(node: ts.ThisExpression): void {

        const method = this.scope[this.scope.length - 1];
        if (method
            && (this.isClassMemberDeclaration(method) || this.isClassMemberSignature(method))
            && this.isStatic(method)) {
            const classNode = <ts.ClassDeclaration>this.scope[this.scope.length - 2];
            if (classNode) {
                const identifier = classNode.name;
                this.writer.writeString(identifier.text);
                return;
            }
        }

        if (node.parent.kind === ts.SyntaxKind.PropertyAccessExpression ||
            node.parent.kind === ts.SyntaxKind.ElementAccessExpression
            ) {

            this.writer.writeString('this');
        } else if (method.kind === ts.SyntaxKind.Constructor) {
            this.writer.writeString('_this');
        } else {
            this.writer.writeString('object::shared_from_this()');
        }
    }

    private processSuperExpression(node: ts.SuperExpression): void {
        if (node.parent.kind === ts.SyntaxKind.CallExpression) {
            const classNode = <ts.ClassDeclaration>this.scope[this.scope.length - 2];
            if (classNode) {
                const heritageClause = classNode.heritageClauses[0];
                if (heritageClause) {
                    const firstType = heritageClause.types[0];
                    if (firstType.expression.kind === ts.SyntaxKind.Identifier) {
                        const identifier = <ts.Identifier>firstType.expression;
                        this.writer.writeString(identifier.text);
                        return;
                    }
                }
            }
        }

        this.writer.writeString('_Super_');
    }

    private processVoidExpression(node: ts.VoidExpression): void {
        this.writer.writeString('Void(');
        this.processExpression(node.expression);
        this.writer.writeString(')');
    }

    private processNonNullExpression(node: ts.NonNullExpression): void {
        this.processExpression(node.expression);
    }

    private processAsExpression(node: ts.AsExpression): void {
        this.writer.writeString('$as<');
        this.processType(node.type);
        this.writer.writeString('>(');
        this.processExpression(node.expression);
        this.writer.writeString(')');
    }

    private processSpreadElement(node: ts.SpreadElement): void {
        if (node.parent && node.parent.kind === ts.SyntaxKind.CallExpression) {
            const info = this.resolver.getSymbolAtLocation((<ts.CallExpression>node.parent).expression);
            const parameters = (<ts.FunctionDeclaration>info.valueDeclaration).parameters;
            if (parameters) {
                let next = false;
                parameters.forEach((item, index) => {
                    if (next) {
                        this.writer.writeString(', ');
                    }

                    const elementAccess = ts.createElementAccess(node.expression, index);
                    this.processExpression(this.fixupParentReferences(elementAccess, node.parent));
                    next = true;
                });
            }
        } else {
            this.processExpression(node.expression);
        }
    }

    private processAwaitExpression(node: ts.AwaitExpression): void {
        //this.writer.writeString('std::async([=]() { ');
        this.writer.writeString('std::async([&]() { ');
        this.processExpression(node.expression);
        this.writer.writeString('; })');
    }

    private resolveIdentifierNamespace(node: ts.Identifier): ts.TypeNode {
        const identifierSymbol = this.resolver.getSymbolAtLocation(node);
        const valDecl = identifierSymbol && identifierSymbol.valueDeclaration;
        if (valDecl) {
            const containerParent = valDecl.parent.parent;
            if (containerParent && this.isNamespaceStatement(containerParent)) {
                const nstype = this.resolver.getOrResolveTypeOfAsTypeNode(containerParent);
                return nstype;
            }

        }
        return null;
    }

    private shouldBeInvokableClassRef(node: ts.Identifier, typeInfo: ts.Type, type: ts.TypeNode): boolean {
            
        if (node.parent) {
            switch (node.parent.kind) {
                case ts.SyntaxKind.ParenthesizedExpression:
                    if ((<ts.ParenthesizedExpression>(node.parent)).expression===node) {
                        return false;
                    }
                    return true;
                case ts.SyntaxKind.TypeAssertionExpression:
                    if ((<ts.TypeAssertion>(node.parent)).type===type) {
                        return false;
                    }
                    return true;
                case ts.SyntaxKind.NewExpression:
                    if ((<ts.NewExpression>(node.parent)).expression===node) {
                        return false;
                    }
                    return true;
                case ts.SyntaxKind.PropertyAccessExpression:
                    if ((<ts.PropertyAccessExpression>(node.parent)).expression===node) {
                        return false;
                    }
                    return true;
                case ts.SyntaxKind.ElementAccessExpression:
                    if ((<ts.ElementAccessExpression>(node.parent)).expression===node) {
                        return false;
                    }
                    return true;
                case ts.SyntaxKind.BinaryExpression:
                    if ((<ts.BinaryExpression>(node.parent)).operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword
                        &&
                        (<ts.BinaryExpression>(node.parent)).right===node) {
                        return false;
                    }
                    return true;
                case ts.SyntaxKind.ModuleDeclaration:
                    if ((<ts.ModuleDeclaration>(node.parent)).name === node) {
                        return false;
                    }
                    return true;
                default:
                    return true;
            }
        }

        return false;
    }

    private resolveIsInvokableClassRef(node: ts.Identifier): boolean {
 
        let result = false;
 
        try {
            const typeInfo = this.resolver.getOrResolveTypeOf(node);
            const type = this.resolver.typeToTypeNode(typeInfo);

            if (type) {
                switch (type.kind) {
                    case ts.SyntaxKind.TypeReference:
                        break;
                    case ts.SyntaxKind.TypeLiteral:
                        break;
                    case ts.SyntaxKind.ConstructorType:
                        if (this.isNewExpressionInStack)
                            result = true;
                        break;
                    case ts.SyntaxKind.TypeQuery:
                        //this.writer.writeString('/*typequery:*/');
                        result = this.shouldBeInvokableClassRef(node, typeInfo, type);
                        break;
                }
            }
        } catch (drop) {

        }

        return result;
    }

    isNewExpressionInStack: boolean = false;
    isInvokableClassRefInStack: boolean = false;

    private processIdentifier(node: ts.Identifier): void {

        const isRightPartOfPropertyAccess = node.parent.kind === ts.SyntaxKind.QualifiedName
            || node.parent.kind === ts.SyntaxKind.PropertyAccessExpression
                && (<ts.PropertyAccessExpression>(node.parent)).name === node;

        let isInvokableClassRef = false;

        if (!isRightPartOfPropertyAccess) {

            let nstype: ts.TypeNode;

            if (this.isWritingMain) {
                nstype = this.resolveIdentifierNamespace(node);
                if (nstype) {
                    this.processType(nstype);
                    this.writer.writeString('::');
                }
            }

            if (!nstype) {
                this.isInvokableClassRefInStack = isInvokableClassRef = this.resolveIsInvokableClassRef(node);
            }
        }

        // fix issue with 'continue'
        if (node.text === 'continue'
            || node.text === 'catch') {
            this.writer.writeString('_');
        }

        this.writer.writeString(node.text);

        if (isInvokableClassRef && !this.isNewExpressionInStack) {
            this.writer.writeString('::constructor_type_obj');
        }
    }

    private processPropertyAccessExpression(node: ts.PropertyAccessExpression): void {

        const typeInfo = this.resolver.getOrResolveTypeOf(node.expression);
        const symbolInfo = this.resolver.getSymbolAtLocation(node.name);

        let valueDeclaration=this.resolver.getSomeGoodDeclaration(symbolInfo);

        const methodAccess = symbolInfo
            && valueDeclaration.kind === ts.SyntaxKind.MethodDeclaration
            && !(node.parent.kind === ts.SyntaxKind.CallExpression && (<ts.CallExpression>node.parent).expression === node);
        const isStaticMethodAccess = symbolInfo && valueDeclaration && this.isStatic(valueDeclaration);

        const getAccess = symbolInfo
            && symbolInfo.declarations
            && symbolInfo.declarations.length > 0
            && (symbolInfo.declarations[0].kind === ts.SyntaxKind.GetAccessor
                || symbolInfo.declarations[0].kind === ts.SyntaxKind.SetAccessor)
            || node.name.text === 'length' && this.resolver.isArrayOrStringType(typeInfo);

        if (methodAccess) {
            if (isStaticMethodAccess) {
                this.writer.writeString('&');
                this.processExpression(<ts.Identifier>node.name);
            } else {
                this.writer.writeString('std::bind(&');
                const pvalueDeclaration = <ts.ClassDeclaration>valueDeclaration.parent;
                this.processExpression(<ts.Identifier>pvalueDeclaration.name);
                this.writer.writeString('::');
                this.processExpression(<ts.Identifier>node.name);
                this.writer.writeString(', ');
                this.processExpression(node.expression);

                const methodDeclaration = <ts.MethodDeclaration>(valueDeclaration);
                methodDeclaration.parameters.forEach((p, i) => {
                    this.writer.writeString(', std::placeholders::_' + (i + 1));
                });

                this.writer.writeString(')');
            }
        } else {
            if (node.expression.kind === ts.SyntaxKind.NewExpression
                || node.expression.kind === ts.SyntaxKind.ArrayLiteralExpression) {
                this.writer.writeString('(');
            }

            // field access
            this.processExpression(node.expression);

            if (node.expression.kind === ts.SyntaxKind.NewExpression
                || node.expression.kind === ts.SyntaxKind.ArrayLiteralExpression) {
                this.writer.writeString(')');
            }

            /*if (this.resolver.isAnyLikeType(typeInfo)) {
                this.writer.writeString('["');
                this.processExpression(<ts.Identifier>node.name);
                this.writer.writeString('"]');
                return;
            } else */if (this.resolver.isStaticAccess(typeInfo)
                || node.expression.kind === ts.SyntaxKind.SuperKeyword
                || typeInfo && typeInfo.symbol && typeInfo.symbol.valueDeclaration
                && typeInfo.symbol.valueDeclaration.kind === ts.SyntaxKind.ModuleDeclaration) {
                this.writer.writeString('::');
            } else {
                this.writer.writeString('->');
            }

            if (getAccess) {
                if ((<any>node).__set === true) {
                    this.writer.writeString('set_');
                } else {
                    this.writer.writeString('get_');
                }
            }

            let name:string;
            let ow = this.writer;
            try {
                this.writer = new CodeWriter();
                this.processExpression(<ts.Identifier>node.name);
                name = this.writer.getText();
            } finally {
                this.writer = ow;
            }
            if (name === "__proto") {
                this.writer.writeString("constructor");
            } else {
                this.writer.writeString(name);
            }

            if (getAccess && (<any>node).__set !== true) {
                this.writer.writeString('()');
            }
        }
    }
}




class FuncDefThings {
    isClassMemberDeclaration:boolean;
    isClassMember:boolean;
    isFunctionOrMethodDeclaration:boolean;
    isFunctionExpression:boolean;
    isFunction:boolean;
    isArrowFunction:boolean;
    writeAsLambdaCFunction:boolean;
    isNestedFunction:boolean;
    inferredReturnType;
    noReturnStatement:boolean;
    noReturn:boolean;
    functionArgs="";

    constructor(e:Emitter,
        node: ts.FunctionExpression | ts.ArrowFunction | ts.FunctionDeclaration | ts.MethodDeclaration
        | ts.ConstructorDeclaration | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration,
        
        ) {

        const r = e.extractReturnInfo(node);
        this.noReturnStatement = !r;
        this.noReturn = !r || !r.hasValue();
    
        this.isNestedFunction = node.parent && node.parent.kind === ts.SyntaxKind.Block;
        this.isClassMemberDeclaration = e.isClassMemberDeclaration(node);
        this.isClassMember = this.isClassMemberDeclaration || e.isClassMemberSignature(node);
        this.isFunctionOrMethodDeclaration =
            (node.kind === ts.SyntaxKind.FunctionDeclaration || this.isClassMember)
            && !this.isNestedFunction;
        this.isFunctionExpression = node.kind === ts.SyntaxKind.FunctionExpression;
        this.isFunction = this.isFunctionOrMethodDeclaration || this.isFunctionExpression;
        this.isArrowFunction = node.kind === ts.SyntaxKind.ArrowFunction || this.isNestedFunction;
        this.writeAsLambdaCFunction = this.isArrowFunction || this.isFunction;
    }

}