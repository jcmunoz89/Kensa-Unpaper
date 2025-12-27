import Store from '../store.js';
import UI from '../ui.js';

const DocumentEditorController = {
    init() {
        const hash = window.location.hash;
        const params = new URLSearchParams(hash.split('?')[1]);
        const docId = params.get('id');
        const dealId = params.get('dealId');

        this.currentDoc = null;
        this.dealId = dealId;
        this.editor = document.getElementById('editor-content');

        if (docId) {
            this.currentDoc = Store.getById('documents', docId);
            if (this.currentDoc) {
                document.getElementById('doc-title').value = this.currentDoc.title;
                this.editor.innerHTML = this.currentDoc.content;
                this.updateStatusUI(this.currentDoc);
            }
        }

        // Event Listeners
        document.querySelectorAll('.btn-insert-var').forEach(btn => {
            btn.addEventListener('click', () => this.insertText(btn.dataset.var));
        });

        document.querySelectorAll('.btn-insert-clause').forEach(btn => {
            btn.addEventListener('click', () => {
                const title = btn.innerText;
                const content = `\n\n${title.toUpperCase()}: Por el presente instrumento las partes acuerdan que... (Texto simulado de la cláusula).\n`;
                this.insertText(content);
            });
        });

        document.getElementById('btn-save').addEventListener('click', () => this.save(false));

        document.getElementById('btn-publish').addEventListener('click', () => {
            if (confirm('¿Está seguro? Al publicar, el documento no se podrá editar y se generará un hash único.')) {
                this.save(true);
            }
        });

        document.getElementById('btn-preview').addEventListener('click', () => {
            const content = this.editor.innerHTML;
            const win = window.open('', '', 'width=800,height=900');
            win.document.write(`
                <html>
                    <head>
                        <title>Vista Previa</title>
                        <style>
                            body { font-family: 'Inter', sans-serif; padding: 40px; line-height: 1.6; }
                        </style>
                    </head>
                    <body>
                        ${content}
                        <script>window.print();<\/script>
                    </body>
                </html>
            `);
            win.document.close();
        });
    },

    insertText(text) {
        this.editor.focus();
        document.execCommand('insertText', false, text);
    },

    async save(isPublishing = false) {
        const title = document.getElementById('doc-title').value;
        const content = this.editor.innerHTML;

        let docHash = null;
        if (isPublishing) {
            const msgBuffer = new TextEncoder().encode(content);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            docHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }

        const data = {
            title,
            content,
            dealId: this.dealId || (this.currentDoc ? this.currentDoc.dealId : null),
            status: isPublishing ? 'published' : 'draft',
            hash: docHash,
            version: this.currentDoc ? this.currentDoc.version + (isPublishing ? 1 : 0) : 1
        };

        if (this.currentDoc) {
            this.currentDoc = Store.update('documents', this.currentDoc.id, data);
        } else {
            this.currentDoc = Store.add('documents', data);
        }

        this.updateStatusUI(this.currentDoc);
        UI.showToast(isPublishing ? 'Documento Publicado y Bloqueado' : 'Borrador guardado', 'success');
    },

    updateStatusUI(doc) {
        document.getElementById('doc-status').innerText = doc.status === 'published' ? 'Publicado' : 'Borrador';
        document.getElementById('doc-status').className = `badge badge-${doc.status === 'published' ? 'success' : 'warning'}`;
        document.getElementById('doc-version').innerText = `v${doc.version}`;
        document.getElementById('last-saved').innerText = 'Guardado: ' + UI.formatDate(doc.updatedAt);

        if (doc.hash) {
            document.getElementById('doc-hash').innerText = 'SHA-256: ' + doc.hash.substring(0, 16) + '...';
        }

        if (doc.status === 'published') {
            this.editor.contentEditable = false;
            this.editor.style.backgroundColor = '#F3F4F6';
            document.getElementById('btn-save').disabled = true;
            document.getElementById('btn-publish').disabled = true;
            document.getElementById('btn-publish').innerText = 'Enviado a Firma';
        }
    }
};

export default DocumentEditorController;
