/**
 * Onda 1 (Sprint 1.2 — Item 6): Editor Rich Text Híbrido para Ofícios (TipTap v3 -> Google Docs PR/2018).
 * Carregado exclusivamente pelo chunk lazy da rota #oficios.
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TableKit } from '@tiptap/extension-table';

export interface PresetPr2018Config {
  indentFirstLine: boolean;
  lineSpacing: number;
  fontFamily: string;
  fontSizePt: number;
}

let activeEditor: Editor | null = null;
let presetState: PresetPr2018Config = {
  indentFirstLine: true,
  lineSpacing: 1.15,
  fontFamily: 'Arial',
  fontSizePt: 12
};

function syncTextareaEspelho(): void {
  const textarea = document.getElementById('oficioCorpoInput') as HTMLTextAreaElement | null;
  if (!textarea || !activeEditor) return;
  textarea.value = activeEditor.getText({ blockSeparator: '\n\n' }).trim();
}

function aplicarVisualHostPr2018(): void {
  const surface = document.getElementById('oficioRichEditorSurface');
  if (!surface) return;
  surface.classList.toggle('oficio-pr2018-indent', presetState.indentFirstLine);
  surface.style.setProperty('--oficio-line-spacing', String(presetState.lineSpacing));
}

function atualizarEstadoToolbar(toolbar: HTMLElement): void {
  if (!activeEditor) return;

  const toggleBtn = (cmd: string, active: boolean) => {
    const btn = toolbar.querySelector(`[data-editor-cmd="${cmd}"]`) as HTMLButtonElement | null;
    if (btn) {
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  };

  toggleBtn('bold', activeEditor.isActive('bold'));
  toggleBtn('italic', activeEditor.isActive('italic'));
  toggleBtn('underline', activeEditor.isActive('underline'));
  toggleBtn('bulletList', activeEditor.isActive('bulletList'));
  toggleBtn('orderedList', activeEditor.isActive('orderedList'));
  toggleBtn('alignLeft', activeEditor.isActive({ textAlign: 'left' }));
  toggleBtn('alignCenter', activeEditor.isActive({ textAlign: 'center' }));
  toggleBtn('alignRight', activeEditor.isActive({ textAlign: 'right' }));
  toggleBtn('alignJustify', activeEditor.isActive({ textAlign: 'justify' }));
  toggleBtn('indent25', presetState.indentFirstLine);

  const inTable = activeEditor.isActive('table');
  ['addRowAfter', 'addColumnAfter', 'deleteTable'].forEach((cmd) => {
    const btn = toolbar.querySelector(`[data-editor-cmd="${cmd}"]`) as HTMLButtonElement | null;
    if (btn) btn.disabled = !inTable;
  });
}

export function aplicarPresetPr2018(): void {
  presetState.indentFirstLine = true;
  presetState.lineSpacing = 1.15;
  const selSpacing = document.getElementById('oficioLineSpacingSelect') as HTMLSelectElement | null;
  if (selSpacing) selSpacing.value = '1.15';

  if (activeEditor) {
    activeEditor.chain().focus().selectAll().setTextAlign('justify').run();
  }
  aplicarVisualHostPr2018();
  const toolbar = document.getElementById('oficioRichToolbar');
  if (toolbar) atualizarEstadoToolbar(toolbar);
  window.OlymposApp?.showToast?.('Preset PR/2018 aplicado: Justificado, Arial 12pt, recuo 2,5 cm e espaçamento 1,15.');
}

export function getCorpoJson(): Record<string, any> | null {
  if (!activeEditor) return null;
  const text = activeEditor.getText().trim();
  const json = activeEditor.getJSON() as Record<string, any>;
  const hasTable = JSON.stringify(json).includes('"type":"table"');
  if (!text && !hasTable) return null;
  return json;
}

export function getCorpoTextoPlano(): string {
  if (activeEditor) {
    return activeEditor.getText({ blockSeparator: '\n\n' }).trim();
  }
  const textarea = document.getElementById('oficioCorpoInput') as HTMLTextAreaElement | null;
  return textarea ? textarea.value.trim() : '';
}

export function getPresetConfig(): PresetPr2018Config {
  return { ...presetState };
}

export function clearOficioEditor(): void {
  if (activeEditor) {
    activeEditor.commands.clearContent(true);
  }
  syncTextareaEspelho();
}

export function mountOficioRichEditor(): void {
  const host = document.getElementById('oficioRichEditorHost');
  const textarea = document.getElementById('oficioCorpoInput') as HTMLTextAreaElement | null;
  if (!host) return;

  if (host.dataset.tiptapMounted === '1' && activeEditor) {
    return;
  }

  if (activeEditor) {
    activeEditor.destroy();
    activeEditor = null;
  }

  host.dataset.tiptapMounted = '1';
  host.innerHTML =
    '<div class="oficio-editor-shell">' +
      '<div id="oficioRichToolbar" class="oficio-editor-toolbar" role="toolbar" aria-label="Formatação do Ofício PR/2018">' +
        '<div class="oficio-toolbar-group">' +
          '<button type="button" class="editor-tool-btn" data-editor-cmd="bold" aria-label="Negrito" aria-pressed="false" title="Negrito (Ctrl+B)"><strong>N</strong></button>' +
          '<button type="button" class="editor-tool-btn" data-editor-cmd="italic" aria-label="Itálico" aria-pressed="false" title="Itálico (Ctrl+I)"><em>I</em></button>' +
          '<button type="button" class="editor-tool-btn" data-editor-cmd="underline" aria-label="Sublinhado" aria-pressed="false" title="Sublinhado (Ctrl+U)"><u>S</u></button>' +
        '</div>' +
        '<div class="oficio-toolbar-group">' +
          '<button type="button" class="editor-tool-btn" data-editor-cmd="alignLeft" aria-label="Alinhar à esquerda" aria-pressed="false" title="Alinhar à esquerda">Esq</button>' +
          '<button type="button" class="editor-tool-btn" data-editor-cmd="alignCenter" aria-label="Centralizar" aria-pressed="false" title="Centralizar">Cen</button>' +
          '<button type="button" class="editor-tool-btn" data-editor-cmd="alignRight" aria-label="Alinhar à direita" aria-pressed="false" title="Alinhar à direita">Dir</button>' +
          '<button type="button" class="editor-tool-btn is-active" data-editor-cmd="alignJustify" aria-label="Justificar" aria-pressed="true" title="Justificar (PR/2018)">Just</button>' +
        '</div>' +
        '<div class="oficio-toolbar-group">' +
          '<button type="button" class="editor-tool-btn is-active" data-editor-cmd="indent25" aria-label="Recuo 1ª linha 2,5 cm" aria-pressed="true" title="Recuo 1ª linha 2,5 cm (PR/2018)">Recuo 2,5cm</button>' +
          '<select id="oficioLineSpacingSelect" class="editor-tool-select" aria-label="Espaçamento entre linhas">' +
            '<option value="1">1,0</option>' +
            '<option value="1.15" selected>1,15</option>' +
            '<option value="1.5">1,5</option>' +
          '</select>' +
        '</div>' +
        '<div class="oficio-toolbar-group">' +
          '<button type="button" class="editor-tool-btn" data-editor-cmd="bulletList" aria-label="Lista com marcadores" aria-pressed="false" title="Lista com marcadores">• Lista</button>' +
          '<button type="button" class="editor-tool-btn" data-editor-cmd="orderedList" aria-label="Lista numerada" aria-pressed="false" title="Lista numerada">1. Lista</button>' +
        '</div>' +
        '<div class="oficio-toolbar-group">' +
          '<button type="button" class="editor-tool-btn" data-editor-cmd="insertTable" aria-label="Inserir tabela 3x3" title="Inserir tabela 3x3">Tabela 3×3</button>' +
          '<button type="button" class="editor-tool-btn" data-editor-cmd="addRowAfter" aria-label="Adicionar linha na tabela" disabled title="Adicionar linha">+Linha</button>' +
          '<button type="button" class="editor-tool-btn" data-editor-cmd="addColumnAfter" aria-label="Adicionar coluna na tabela" disabled title="Adicionar coluna">+Col</button>' +
          '<button type="button" class="editor-tool-btn" data-editor-cmd="deleteTable" aria-label="Remover tabela" disabled title="Remover tabela">×Tab</button>' +
        '</div>' +
        '<div class="oficio-toolbar-group" style="margin-left: auto;">' +
          '<button type="button" class="btn btn-secondary btn-sm" data-editor-cmd="presetPr2018" title="Aplicar padrão Manual da Presidência PR/2018">Aplicar Preset PR/2018</button>' +
        '</div>' +
      '</div>' +
      '<div id="oficioRichEditorSurface" class="oficio-editor-surface oficio-pr2018-indent" aria-label="Corpo formatado do ofício"></div>' +
    '</div>';

  if (textarea) {
    textarea.classList.add('hidden');
    textarea.setAttribute('aria-hidden', 'true');
  }

  const surfaceEl = document.getElementById('oficioRichEditorSurface')!;
  const toolbarEl = document.getElementById('oficioRichToolbar')!;
  const initialText = textarea && textarea.value.trim() ? textarea.value.trim() : '';

  activeEditor = new Editor({
    element: surfaceEl,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] }
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        defaultAlignment: 'justify'
      }),
      TableKit.configure({
        table: { resizable: false }
      })
    ],
    content: initialText
      ? {
          type: 'doc',
          content: initialText.split(/\n{2,}/).map((para) => ({
            type: 'paragraph',
            attrs: { textAlign: 'justify' },
            content: [{ type: 'text', text: para }]
          }))
        }
      : '<p style="text-align: justify"></p>',
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'Texto Oficial do Ofício'
      }
    },
    onUpdate: () => {
      syncTextareaEspelho();
      atualizarEstadoToolbar(toolbarEl);
    },
    onSelectionUpdate: () => {
      atualizarEstadoToolbar(toolbarEl);
    }
  });

  aplicarVisualHostPr2018();
  atualizarEstadoToolbar(toolbarEl);

  toolbarEl.addEventListener('click', (ev) => {
    const target = ev.target as HTMLElement | null;
    const btn = target?.closest?.('[data-editor-cmd]') as HTMLButtonElement | null;
    if (!btn || !activeEditor) return;

    const cmd = btn.getAttribute('data-editor-cmd');
    switch (cmd) {
      case 'bold':
        activeEditor.chain().focus().toggleBold().run();
        break;
      case 'italic':
        activeEditor.chain().focus().toggleItalic().run();
        break;
      case 'underline':
        activeEditor.chain().focus().toggleUnderline().run();
        break;
      case 'alignLeft':
        activeEditor.chain().focus().setTextAlign('left').run();
        break;
      case 'alignCenter':
        activeEditor.chain().focus().setTextAlign('center').run();
        break;
      case 'alignRight':
        activeEditor.chain().focus().setTextAlign('right').run();
        break;
      case 'alignJustify':
        activeEditor.chain().focus().setTextAlign('justify').run();
        break;
      case 'indent25':
        presetState.indentFirstLine = !presetState.indentFirstLine;
        aplicarVisualHostPr2018();
        break;
      case 'bulletList':
        activeEditor.chain().focus().toggleBulletList().run();
        break;
      case 'orderedList':
        activeEditor.chain().focus().toggleOrderedList().run();
        break;
      case 'insertTable':
        activeEditor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        break;
      case 'addRowAfter':
        activeEditor.chain().focus().addRowAfter().run();
        break;
      case 'addColumnAfter':
        activeEditor.chain().focus().addColumnAfter().run();
        break;
      case 'deleteTable':
        activeEditor.chain().focus().deleteTable().run();
        break;
      case 'presetPr2018':
        aplicarPresetPr2018();
        break;
      default:
        break;
    }
    atualizarEstadoToolbar(toolbarEl);
  });

  const selSpacing = document.getElementById('oficioLineSpacingSelect') as HTMLSelectElement | null;
  if (selSpacing) {
    selSpacing.addEventListener('change', () => {
      presetState.lineSpacing = parseFloat(selSpacing.value) || 1.15;
      aplicarVisualHostPr2018();
    });
  }
}

if (typeof window !== 'undefined') {
  window.OlymposOficioEditor = {
    mount: mountOficioRichEditor,
    getCorpoJson,
    getCorpoTextoPlano,
    getPresetConfig,
    aplicarPresetPr2018,
    clear: clearOficioEditor
  };
}
