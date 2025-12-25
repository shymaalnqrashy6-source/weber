const editor = document.getElementById('code-editor');
const runBtn = document.getElementById('run-btn');
const lineCounter = document.getElementById('line-counter');

const DEFAULT_CODE = `# مشروع لوحة تحكم ذكية (Modern Dashboard)
Var score = 85
Var status = "Active"

# الهيدر العلوي
Row {
    Column {
        Title "Moe Analytics" size=1
        Text "إحصائيات الأداء المباشرة للسنة الحالية."
    }
}

Space 40

# صف الإحصائيات
Row {
    Column {
        Card {
            Title "السكور الحالي" size=3
            Title "85" size=1 id="score" # عنصر تفاعلي
            Text "بناءً على آخر 30 يوم من النشاط."
        }
    }
    Column {
        Card {
            Title "حالة النظام" size=3
            Title "Active" size=2 id="status"
            
            Space 10
            
            # أزرار التحكم
            Row {
                Button "ترقية الأداء"
                OnClick {
                    Set score = "window.score += 5"
                }
                
                Button "تغيير الحالة"
                OnClick {
                    Set status = "window.status = 'Premium'"
                }
            }
        }
    }
}

Space 20

# قسم المهام
Card {
    Title "المهام البرمجية" size=3
    Text "• تحديث قاعدة البيانات بنجاح"
    Text "• تهيئة واجهة المستخدم VS Code"
    Text "• تحسين سرعة المترجم (Moe Compiler)"
}
`;

function initEditor() {
    editor.value = DEFAULT_CODE;

    // Initial compile
    triggerCompile();

    // Event listeners
    editor.addEventListener('input', () => {
        updateLineCount();
        debounce(triggerCompile, 500)();
    });

    runBtn.addEventListener('click', () => {
        triggerCompile();
    });

    // Handle Tab key
    editor.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = editor.selectionStart;
            editor.value = editor.value.substring(0, start) + "    " + editor.value.substring(editor.selectionEnd);
            editor.selectionStart = editor.selectionEnd = start + 4;
        }
    });

    updateLineCount();
}

function triggerCompile() {
    const code = editor.value;
    const html = window.MoeCompiler.compile(code);
    window.MoePreview.update(html);
}

function updateLineCount() {
    const text = editor.value;
    const lines = text.split('\n').length;
    const cursor = editor.selectionStart;
    const col = cursor - text.lastIndexOf('\n', cursor - 1);
    lineCounter.innerText = `Ln ${lines}, Col ${col}`;
}

let debounceTimer;
function debounce(func, delay) {
    return function () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => func.apply(this, arguments), delay);
    };
}

// Initialize on load
window.addEventListener('DOMContentLoaded', initEditor);
