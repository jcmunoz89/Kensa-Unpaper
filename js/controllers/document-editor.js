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
        this.missingDealWarned = false;

        if (!this.editor) {
            UI.showToast('No se encontró el editor de documentos.', 'error');
            return;
        }

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

        document.getElementById('btn-save').addEventListener('click', async () => {
            await this.save(false);
        });

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

    async computeHash(content) {
        if (window.crypto?.subtle?.digest) {
            const msgBuffer = new TextEncoder().encode(content);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }

        // Fallback no criptográfico para navegadores sin SubtleCrypto.
        let hash = 0;
        for (let i = 0; i < content.length; i += 1) {
            hash = ((hash << 5) - hash) + content.charCodeAt(i);
            hash |= 0;
        }
        return `fallback_${Math.abs(hash)}_${Date.now()}`;
    },

    async save(isPublishing = false) {
        try {
            const title = document.getElementById('doc-title').value.trim();
            const content = UI.sanitizeRichHTML(this.editor.innerHTML).trim();

            if (!title) {
                UI.showToast('Debes ingresar un título para el documento.', 'warning');
                return null;
            }
            if (!content) {
                UI.showToast('El documento está vacío.', 'warning');
                return null;
            }

            this.editor.innerHTML = content;
            const resolvedDealId = this.dealId || (this.currentDoc ? this.currentDoc.dealId : null) || null;

            if (isPublishing && !resolvedDealId && !this.missingDealWarned) {
                this.missingDealWarned = true;
                UI.showToast('Publicando sin negocio asociado. Para crear trámite desde Negocios, abre este editor desde el deal.', 'warning');
            }

            let docHash = null;
            if (isPublishing) {
                docHash = await this.computeHash(content);
            }

            const currentVersion = Number(this.currentDoc?.version) || 1;
            const nextVersion = this.currentDoc
                ? (isPublishing && this.currentDoc.status === 'published' ? currentVersion + 1 : currentVersion)
                : 1;

            const data = {
                title,
                content,
                dealId: resolvedDealId,
                status: isPublishing ? 'published' : 'draft',
                hash: docHash,
                version: nextVersion
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
            return this.currentDoc;
        } catch (err) {
            console.error('Error saving document:', err);
            UI.showToast('No se pudo publicar el documento. Revisa la consola para más detalle.', 'error');
            return null;
        }
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
