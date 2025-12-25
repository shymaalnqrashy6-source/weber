class MoeCompiler {
    constructor() {
        this.styles = {};
        this.scripts = [];
        this.tabLevel = 0;
        this.components = {};

        // Define mapping for standard HTML elements
        this.htmlTags = {
            'Section': 'section', 'Container': 'div', 'Row': 'div', 'Column': 'div',
            'Header': 'header', 'Footer': 'footer', 'Nav': 'nav', 'Main': 'main',
            'Aside': 'aside', 'Article': 'article', 'Div': 'div',
            'Text': 'p', 'Paragraph': 'p', 'Span': 'span', 'Link': 'a',
            'Input': 'input', 'Textarea': 'textarea', 'Select': 'select',
            'Option': 'option', 'Checkbox': 'input', 'Radio': 'input',
            'Image': 'img', 'Video': 'video', 'Audio': 'audio', 'Canvas': 'canvas',
            'Ul': 'ul', 'Ol': 'ol', 'Li': 'li', 'Menu': 'menu',
            'Table': 'table', 'Tr': 'tr', 'Td': 'td', 'Th': 'th'
        };

        this.init();
    }

    init() {
        this.reset();
    }

    reset() {
        this.styles = {};
        this.scripts = [];
        this.tabLevel = 0;
        this.generatedIds = 0;
    }

    generateId() {
        return `moe-ref-${++this.generatedIds}`;
    }

    stripQuotes(str) {
        if (!str) return '';
        return str.replace(/^["']|["']$/g, '');
    }

    parseArgs(args) {
        const result = {
            params: [],
            attrs: {}
        };
        args.forEach(arg => {
            if (arg.includes('=')) {
                const [key, val] = arg.split('=');
                result.attrs[key] = this.stripQuotes(val);
            } else {
                result.params.push(this.stripQuotes(arg));
            }
        });
        return result;
    }

    compile(code) {
        this.reset();
        const lines = this.preprocess(code);
        let htmlOutput = '';

        // Context stack for nested blocks
        const stack = [];

        lines.forEach((lineObj, index) => {
            let line = lineObj.text.trim();
            if (!line || line.startsWith('#')) return;

            // Handle properties: Div.color = red
            if (line.includes('.') && line.includes('=')) {
                const match = line.match(/^(\w+)\.([\w-]+)\s*=\s*(.*)$/);
                if (match) {
                    const [_, element, prop, value] = match;
                    // Note: This is simplified. In a real scenario, this would apply to the last instance or a specific ref.
                    // For now, let's treat it as a style injection for the next matching element.
                    if (!this.pendingStyles) this.pendingStyles = {};
                    this.pendingStyles[prop] = this.stripQuotes(value);
                    return;
                }
            }

            // Detect block start/end
            const hasBlockOpen = line.endsWith('{');
            const hasBlockClose = line === '}';

            if (hasBlockClose) {
                const top = stack.pop();
                if (top) htmlOutput += `</${top}>\n`;
                return;
            }

            if (hasBlockOpen) line = line.slice(0, -1).trim();

            const parts = line.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
            const cmd = parts[0];
            const args = this.parseArgs(parts.slice(1));

            const result = this.handleCommand(cmd, args, hasBlockOpen);

            if (result.html) htmlOutput += result.html + '\n';
            if (result.js) this.scripts.push(result.js);
            if (hasBlockOpen && result.tag) stack.push(result.tag);
        });

        // Close any remaining tags
        while (stack.length) htmlOutput += `</${stack.pop()}>\n`;

        return this.wrapInBoilerplate(htmlOutput);
    }

    preprocess(code) {
        // Simple preprocessor to normalize blocks
        return code.split('\n').map(l => ({ text: l }));
    }

    handleCommand(cmd, args, isBlock) {
        let html = '';
        let js = '';
        let tag = '';

        const elementId = this.generateId();
        const styleStr = this.getPendingStyles();

        // 1. Elements
        if (this.htmlTags[cmd]) {
            tag = this.htmlTags[cmd];
            let inner = args.params[0] || '';
            let attrs = '';

            if (cmd === 'Title') {
                const level = args.attrs.size || 1;
                tag = `h${level}`;
            } else if (cmd === 'Link') {
                attrs += ` href="${args.params[0]}"`;
                inner = args.params[1] || '';
            } else if (cmd === 'Image') {
                attrs += ` src="${args.attrs.src || args.params[0]}"`;
                inner = '';
            } else if (cmd === 'Input') {
                attrs += ` type="${args.attrs.type || 'text'}" placeholder="${args.params[0] || ''}"`;
                inner = '';
            } else if (cmd === 'Checkbox' || cmd === 'Radio') {
                attrs += ` type="${cmd.toLowerCase()}"`;
            }

            // Custom attributes
            for (let [k, v] of Object.entries(args.attrs)) {
                if (!['size', 'src', 'type'].includes(k)) attrs += ` ${k}="${v}"`;
            }

            html = `<${tag} id="${elementId}" style="${styleStr}"${attrs} class="moe-element moe-${cmd.toLowerCase()}">${inner}`;
            if (!isBlock && !['img', 'input', 'br', 'hr'].includes(tag)) html += `</${tag}>`;

            this.lastElementId = elementId;
            return { html, tag };
        }

        // 2. Logic & UI Layouts
        switch (cmd) {
            case 'Page':
                return { html: '' };
            case 'Bg':
                html = `<style>body { background-color: ${args.params[0]}; }</style>`;
                return { html };
            case 'Row':
                tag = 'div';
                html = `<div id="${elementId}" class="moe-row" style="${styleStr}">`;
                return { html, tag };
            case 'Column':
                tag = 'div';
                html = `<div id="${elementId}" class="moe-col" style="${styleStr}">`;
                return { html, tag };
            case 'Var':
                const varName = args.params[0];
                const varVal = args.params[1] || '0';
                js = `window.${varName} = ${varVal};`;
                return { js };
            case 'OnClick':
                const targetId = this.lastElementId;
                if (targetId) this.currentEvent = { type: 'click', targetId };
                return { html: `<!-- Event: OnClick -->` };
            case 'Set':
                const targetName = args.params[0];
                const newVal = args.params[1];
                // Support window variables and direct strings
                let scriptValue = newVal.startsWith('"') ? newVal : `window.${newVal}`;
                if (newVal.includes('++') || newVal.includes('--') || newVal.includes('+=')) {
                    scriptValue = newVal.replace(/([a-zA-Z_]\w*)/g, 'window.$1');
                    js = `${scriptValue}; const el = document.getElementById("${targetName}"); if(el) el.innerText = window.${targetName.split('.')[0]};`;
                } else {
                    js = `const el = document.getElementById("${targetName}"); if(el) el.innerText = ${scriptValue};`;
                }

                if (this.currentEvent) {
                    const evt = this.currentEvent;
                    js = `document.getElementById("${evt.targetId}").addEventListener("${evt.type}", () => { ${js} });`;
                    this.currentEvent = null;
                }
                return { js };
            case 'Card':
                tag = 'div';
                html = `<div id="${args.attrs.id || elementId}" class="moe-card" style="${styleStr}">`;
                this.lastElementId = args.attrs.id || elementId;
                return { html, tag };
            case 'Space':
                html = `<div style="height: ${args.params[0] || '20'}px; width: 100%;"></div>`;
                return { html };
            case 'Alert':
                js = `alert("${args.params[0]}");`;
                if (this.currentEvent) {
                    const evt = this.currentEvent;
                    js = `document.getElementById("${evt.targetId}").addEventListener("${evt.type}", () => { ${js} });`;
                    this.currentEvent = null;
                }
                return { js };
        }

        return { html: `<!-- Moe: ${cmd} -->` };
    }

    getPendingStyles() {
        if (!this.pendingStyles) return '';
        let s = '';
        for (let [k, v] of Object.entries(this.pendingStyles)) {
            s += `${k}:${v};`;
        }
        this.pendingStyles = null;
        return s;
    }

    wrapInBoilerplate(content) {
        return `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600&display=swap');
                    body { 
                        margin: 0; padding: 40px; font-family: 'Outfit', sans-serif; 
                        background: #0f172a; color: #f8fafc; 
                        display: flex; flex-direction: column; align-items: center; min-height: 100vh;
                        overflow-x: hidden;
                    }
                    .moe-row { display: flex; gap: 20px; width: 100%; max-width: 1000px; margin-bottom: 20px; flex-wrap: wrap; }
                    .moe-col { flex: 1; min-width: 250px; display: flex; flex-direction: column; gap: 15px; }
                    .moe-card { 
                        background: #1e293b; border: 1px solid #334155; 
                        padding: 30px; border-radius: 20px; 
                        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                        width: 100%; transition: 0.3s;
                    }
                    .moe-card:hover { transform: translateY(-5px); border-color: #007acc; }
                    h1 { font-size: 3rem; color: #38bdf8; margin: 0 0 10px 0; }
                    p { color: #94a3b8; line-height: 1.6; }
                    button { 
                        background: #38bdf8; color: #0f172a; 
                        border: none; padding: 12px 25px; border-radius: 12px; 
                        font-weight: 600; cursor: pointer; transition: 0.2s;
                        width: fit-content; margin-top: 10px;
                    }
                    button:hover { background: #7dd3fc; transform: scale(1.05); }
                    button:active { transform: scale(0.95); }
                    .moe-element { transition: 0.3s; }
                    * { box-sizing: border-box; }
                </style>
            </head>
            <body>
                ${content}
                <script>
                    (function() {
                        try { ${this.scripts.join('\n')} } catch(e) { console.error('Moe Script Error:', e); }
                    })();
                </script>
            </body>
            </html>
        `;
    }
}

window.MoeCompiler = new MoeCompiler();
