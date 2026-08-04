import {
  type DiagramGenerationMode,
  getSessionOpenAIKey,
  setSessionOpenAIKey,
} from "../ai/openaiDiagram";
import {
  getAIEndpoint,
  getAIModel,
  setAIEndpoint,
  setAIModel,
} from "../ai/aiEndpoint";
import { listAIModels } from "../ai/listModels";
import { h } from "./dom";

export interface AIGenerateRequest {
  /** Optional API key; omitted (blank) for local endpoints. */
  apiKey: string;
  endpoint: string;
  model: string;
  prompt: string;
  mode: DiagramGenerationMode;
  signal: AbortSignal;
}

export class AIGeneratePanel {
  private el: HTMLDivElement | null = null;
  private form!: HTMLFormElement;
  private keyInput!: HTMLInputElement;
  private endpointInput!: HTMLInputElement;
  private modelSelect!: HTMLSelectElement;
  private promptInput!: HTMLTextAreaElement;
  private generateBtn!: HTMLButtonElement;
  private closeBtn!: HTMLButtonElement;
  private modeButtons!: Record<DiagramGenerationMode, HTMLButtonElement>;
  private errorEl!: HTMLDivElement;
  private abort: AbortController | null = null;
  private restoreFocusEl: HTMLElement | null = null;
  private invalidField: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null = null;
  private mode: DiagramGenerationMode = "generate";
  private canModify = false;
  private modelLoadSeq = 0;

  constructor(
    private root: HTMLElement,
    private onGenerate: (request: AIGenerateRequest) => Promise<boolean>,
  ) {}

  get active(): boolean {
    return !!this.el;
  }

  open(opener?: HTMLElement, opts: { canModify?: boolean } = {}): void {
    if (this.el) return;
    this.restoreFocusEl = opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    this.canModify = !!opts.canModify;
    this.mode = this.canModify ? "modify" : "generate";

    const savedKey = getSessionOpenAIKey();
    const savedEndpoint = getAIEndpoint();
    const savedModel = getAIModel();
    this.closeBtn = h("button", {
      class: "ai-panel__close",
      type: "button",
      title: "Close",
      "aria-label": "Close AI generator",
      onclick: () => this.close(),
    }, "x");

    this.keyInput = h("input", {
      class: "ai-panel__input",
      type: "password",
      value: savedKey,
      placeholder: "sk-... (optional for local)",
      autocomplete: "off",
      spellcheck: false,
      "aria-describedby": "ai-panel-error",
    });

    this.endpointInput = h("input", {
      class: "ai-panel__input",
      type: "url",
      value: savedEndpoint,
      placeholder: "https://api.openai.com/v1/responses",
      spellcheck: false,
      "aria-describedby": "ai-panel-error",
      onchange: () => void this.reloadModels(),
    });

    this.modelSelect = h("select", {
      class: "ai-panel__input ai-panel__select",
      "aria-describedby": "ai-panel-error",
      value: savedModel,
    }) as HTMLSelectElement;
    this.modelSelect.append(h("option", { value: savedModel }, savedModel));

    this.promptInput = h(
      "textarea",
      {
        class: "ai-panel__textarea",
        rows: 5,
        spellcheck: true,
        "aria-describedby": "ai-panel-error",
      },
    );

    this.generateBtn = h(
      "button",
      { class: "btn btn--accent", type: "submit" },
      this.submitLabel(savedModel),
    );

    this.modeButtons = {
      generate: h(
        "button",
        { class: "ai-panel__mode", type: "button", onclick: () => this.setMode("generate") },
        "Generate new",
      ),
      modify: h(
        "button",
        {
          class: "ai-panel__mode",
          type: "button",
          disabled: !this.canModify,
          title: this.canModify ? "Modify the current board" : "Create a diagram first to modify it",
          onclick: () => this.setMode("modify"),
        },
        "Modify current",
      ),
    };

    this.errorEl = h("div", { id: "ai-panel-error", class: "ai-panel__error", role: "alert" });
    this.form = h(
      "form",
      { class: "ai-panel__form", onsubmit: (e: Event) => this.submit(e) },
      h("div", { class: "ai-panel__modes", role: "group", "aria-label": "AI diagram mode" }, this.modeButtons.generate, this.modeButtons.modify),
      h(
        "label",
        { class: "ai-panel__field" },
        h("span", null, "Endpoint"),
        this.endpointInput,
      ),
      h(
        "label",
        { class: "ai-panel__field" },
        h("span", null, "Model"),
        this.modelSelect,
      ),
      h(
        "label",
        { class: "ai-panel__field" },
        h("span", null, "API key (optional)"),
        this.keyInput,
      ),
      h(
        "label",
        { class: "ai-panel__field" },
        h("span", null, "Prompt"),
        this.promptInput,
      ),
      this.errorEl,
      h(
        "div",
        { class: "ai-panel__footer" },
        h("span", { class: "ai-panel__hint" }, "Cmd/Ctrl+Enter generate | Esc close"),
        this.generateBtn,
      ),
    );

    const panel = h(
      "section",
      { class: "ai-panel", role: "dialog", "aria-modal": "true", "aria-label": "Generate diagram with AI" },
      h(
        "header",
        { class: "ai-panel__header" },
        h("div", null, h("h2", null, "Generate Diagram"), h("p", null, "Your key is sent directly from this browser to the endpoint and kept for this session only.")),
        this.closeBtn,
      ),
      this.form,
    );

    const backdrop = h("div", { class: "ai-panel-backdrop" }, panel);
    backdrop.addEventListener("pointerdown", (e) => {
      if (e.target === backdrop) this.close();
    });
    panel.addEventListener("pointerdown", (e) => e.stopPropagation());
    panel.addEventListener("click", (e) => e.stopPropagation());
    panel.addEventListener("keydown", this.onPanelKeyDown);

    this.root.appendChild(backdrop);
    this.el = backdrop;
    this.syncMode();
    void this.reloadModels();
    requestAnimationFrame(() => (savedKey ? this.promptInput : this.endpointInput).focus());
  }

  /**
   * Query the endpoint's /models route and repopulate the dropdown, keeping the
   * currently selected/persisted model selected when present. Failures leave the
   * dropdown as-is (the persisted model still works).
   */
  private async reloadModels(): Promise<void> {
    const seq = ++this.modelLoadSeq;
    const endpoint = this.endpointInput?.value.trim();
    const current = this.modelSelect.value;
    if (!endpoint) return;
    try {
      const ids = await listAIModels(endpoint);
      if (seq !== this.modelLoadSeq || !this.modelSelect || !this.el) return;
      const options = ids.length ? ids : [current || getAIModel()];
      this.modelSelect.textContent = "";
      for (const id of options) {
        this.modelSelect.append(h("option", { value: id }, id));
      }
      if (current && ids.includes(current)) this.modelSelect.value = current;
    } catch {
      // Keep the current persisted model; the dropdown stays usable.
    }
  }

  close(force = false): void {
    if (this.abort) {
      this.abort.abort();
      this.abort = null;
      this.setLoading(false);
      this.showError("Generation was cancelled.");
      if (!force) return;
    }
    const restoreFocusEl = this.restoreFocusEl;
    this.restoreFocusEl = null;
    this.invalidField = null;
    if (!this.el) {
      restoreFocusEl?.focus();
      return;
    }
    this.el.remove();
    this.el = null;
    restoreFocusEl?.focus();
  }

  destroy(): void {
    this.close(true);
  }

  private onPanelKeyDown = (e: KeyboardEvent): void => {
    e.stopPropagation();
    if (e.key === "Tab") {
      this.trapFocus(e);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      this.close();
      return;
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
      void this.submit();
    }
  };

  private async submit(e?: Event): Promise<void> {
    e?.preventDefault();
    if (this.abort) return;

    const apiKey = this.keyInput.value.trim();
    const endpoint = this.endpointInput.value.trim();
    const model = this.modelSelect.value.trim();
    const prompt = this.promptInput.value.trim();
    if (!endpoint) {
      this.showFieldError(this.endpointInput, "Enter an endpoint URL.");
      this.endpointInput.focus();
      return;
    }
    if (!/^https?:\/\//i.test(endpoint)) {
      this.showFieldError(this.endpointInput, "Endpoint must be an http(s) URL.");
      this.endpointInput.focus();
      return;
    }
    if (!model) {
      this.showFieldError(this.modelSelect, "Choose a model.");
      this.modelSelect.focus();
      return;
    }
    if (!prompt) {
      this.showFieldError(
        this.promptInput,
        this.mode === "modify" ? "Describe how to modify the diagram." : "Describe the diagram you want to generate.",
      );
      this.promptInput.focus();
      return;
    }
    if (this.mode === "modify" && !this.canModify) {
      this.showError("Create a diagram before using Modify current.");
      return;
    }

    setSessionOpenAIKey(apiKey);
    setAIEndpoint(endpoint);
    setAIModel(model);
    this.showError("");
    const controller = new AbortController();
    this.abort = controller;
    this.setLoading(true);
    try {
      const applied = await this.onGenerate({
        apiKey,
        endpoint,
        model,
        prompt,
        mode: this.mode,
        signal: controller.signal,
      });
      if (applied) this.close(true);
    } catch (err) {
      if (controller.signal.aborted) return;
      this.showError(err instanceof Error ? err.message : "Could not generate a diagram.");
    } finally {
      if (this.abort === controller) {
        this.abort = null;
        this.setLoading(false);
      }
    }
  }

  private setLoading(loading: boolean): void {
    this.form.setAttribute("aria-busy", String(loading));
    this.keyInput.disabled = loading;
    this.endpointInput.disabled = loading;
    this.modelSelect.disabled = loading;
    this.promptInput.disabled = loading;
    this.modeButtons.generate.disabled = loading;
    this.modeButtons.modify.disabled = loading || !this.canModify;
    this.generateBtn.disabled = loading;
    this.closeBtn.title = loading ? "Cancel generation" : "Close";
    this.closeBtn.setAttribute("aria-label", loading ? "Cancel generation" : "Close AI generator");
    this.generateBtn.textContent = loading ? "Working..." : this.submitLabel(this.modelSelect?.value);
  }

  private showError(message: string): void {
    if (this.invalidField) {
      this.invalidField.removeAttribute("aria-invalid");
      this.invalidField = null;
    }
    this.errorEl.textContent = message;
    this.errorEl.classList.toggle("is-visible", !!message);
  }

  private showFieldError(field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, message: string): void {
    this.showError(message);
    this.invalidField = field;
    field.setAttribute("aria-invalid", "true");
  }

  private setMode(mode: DiagramGenerationMode): void {
    if (mode === "modify" && !this.canModify) return;
    this.mode = mode;
    this.syncMode();
  }

  private syncMode(): void {
    for (const mode of ["generate", "modify"] as const) {
      const active = this.mode === mode;
      this.modeButtons[mode].classList.toggle("is-active", active);
      this.modeButtons[mode].setAttribute("aria-pressed", String(active));
    }
    this.promptInput.placeholder = this.mode === "modify"
      ? "Describe the change. Example: Add Redis between the API and database, and label cache hits."
      : "Describe the diagram you want. Example: A browser hits a CDN, API gateway, auth service, worker queue, Postgres, and Redis cache.";
    this.generateBtn.textContent = this.submitLabel(this.modelSelect?.value);
  }

  private submitLabel(model?: string): string {
    return `${this.mode === "modify" ? "Modify" : "Generate"} with ${model || "model"}`;
  }

  private trapFocus(e: KeyboardEvent): void {
    const focusables = [
      this.closeBtn,
      this.modeButtons.generate,
      this.modeButtons.modify,
      this.endpointInput,
      this.modelSelect,
      this.keyInput,
      this.promptInput,
      this.generateBtn,
    ].filter(
      (el) => !el.disabled,
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }
}
