import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('test-element')
export class TestElement extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 16px;
      border: 2px solid blue;
      color: blue;
      font-family: sans-serif;
    }
  `;

  @property({ type: String })
  greeting = 'Hello';

  @property({ type: String })
  name = 'World';

  render() {
    return html`<p>${this.greeting}, ${this.name}! This is a Lit component.</p>`;
  }
}
