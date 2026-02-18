import Store from '../store.js';
import Storage from '../storage.js';
import Auth from '../auth.js';
import Audit from '../audit.js';
import UI from '../ui.js?v=2';

const DocumentEditorController = {
    init() {
        const hash = window.location.hash;
        const params = new URLSearchParams(hash.split('?')[1]);
        const docId = params.get('id');
        const dealId = params.get('dealId');

        this.currentDoc = null;
        this.dealId = dealId;
        this.editor = document.getElementById('editor-content');
        this.tenantId = Auth.getTenantId();
        this.scope = this.tenantId ? Storage.tenantScope(this.tenantId) : null;

        if (docId) {
            this.currentDoc = Store.getById('documents', docId);
            if (this.currentDoc) {
                document.getElementById('doc-title').value = this.currentDoc.title;
                this.editor.innerHTML = UI.sanitizeRichHTML(this.currentDoc.content || '');
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

        const btnVoid = document.getElementById('btn-void');
        if (btnVoid) {
            btnVoid.addEventListener('click', () => this.voidVersion());
        }

        document.getElementById('btn-preview').addEventListener('click', () => {
            const content = UI.sanitizeRichHTML(this.editor.innerHTML);
            const win = window.open('', '', 'width=800,height=900');
            if (!win || !win.document) {
                UI.showToast('El navegador bloqueó la ventana de previsualización.', 'warning');
                return;
            }
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
        const content = UI.sanitizeRichHTML(this.editor.innerHTML);
        this.editor.innerHTML = content;

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

        if (isPublishing && this.scope) {
            Storage.add(this.scope, 'document_versions', {
                documentId: this.currentDoc.id,
                dealId: data.dealId,
                title: data.title,
                version: data.version,
                hash: docHash,
                content: content,
                status: 'published',
                createdBy: Auth.getSession()?.uid || 'system'
            });
            Audit.append(this.tenantId, { action: 'DOCUMENT_PUBLISHED', meta: { documentId: this.currentDoc.id, version: data.version } });
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

        const btnVoid = document.getElementById('btn-void');

        if (doc.status === 'published') {
            this.editor.contentEditable = false;
            this.editor.style.backgroundColor = '#F3F4F6';
            document.getElementById('btn-save').disabled = true;
            document.getElementById('btn-publish').disabled = true;
            document.getElementById('btn-publish').innerText = 'Enviado a Firma';
            if (btnVoid) btnVoid.style.display = 'inline-flex';
        } else {
            if (btnVoid) btnVoid.style.display = 'none';
        }
    },

    voidVersion() {
        if (!this.scope || !this.currentDoc || !this.currentDoc.hash) return;
        const reason = window.prompt('Motivo de anulación');
        if (!reason) return;

        const versions = Storage.list(this.scope, 'document_versions');
        const version = versions.find(v => v.documentId === this.currentDoc.id && v.hash === this.currentDoc.hash);
        if (!version) {
            UI.showToast('No se encontró la versión publicada', 'error');
            return;
        }

        Storage.update(this.scope, 'document_versions', version.id, {
            voidedAt: new Date().toISOString(),
            voidedByUid: Auth.getSession()?.uid || 'system',
            voidReason: reason,
            voidScope: 'future_use_only'
        });

        Audit.append(this.tenantId, { action: 'VOID_DOC_VERSION', meta: { documentId: this.currentDoc.id, version: version.version } });
        UI.showToast('Versión anulada', 'success');
    }
};

export default DocumentEditorController;
