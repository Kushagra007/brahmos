// @flow
import type { PartMeta, TemplateTagType } from './flow.types';

const TAG_QUOTE_REGEX = /[<>"]/g;

/**
 * attribute name on the string part can be
 * Any character except control character space \s, ", ', =, <
 * followed by = or space or closing tag >
 * and should start after \s or should be the first character
 *
 * Pick the third value on the exec group
 */
const ATTR_NAME_REGEX = /(^|\s)([^\s"'=<]+)(?=[\s=>])/g;

export const attrMarker = 'data-brahmos-attr';
export const marker = '{{brahmos}}';
export const nodeMarker = `<!--${marker}-->`;

function extractAttributeName(str) {
  let result;
  const names = [];
  while ((result = ATTR_NAME_REGEX.exec(str))) {
    const attrName = result[2];

    if (attrName) {
      names.push(result[2]);
    }
  }
  return names;
}

export default class TemplateTag implements TemplateTagType {
  $key: 'svgTemplate' | 'template';

  $value: ?HTMLTemplateElement;

  strings: Array<string>;

  template: ?HTMLTemplateElement;

  svgTemplate: ?HTMLTemplateElement;

  partsMeta: Array<PartMeta>;

  constructor(strings: Array<string>) {
    this.strings = strings;
    this.template = null;
    this.svgTemplate = null;
    this.partsMeta = [];
  }

  create(isSvgPart: boolean) {
    if (isSvgPart && this.svgTemplate) return;

    if (this.template) return;

    this.partsMeta = this.getPartsMeta();

    this.createTemplate(isSvgPart);
  }

  getPartsMeta() {
    const { strings } = this;
    let tagStarted = false;
    let quoteStart;
    let tagAttrs = [];
    const partsMeta = [];
    /**
     * Loop on the string parts and check for tags on each of the string
     * Ignore tags which is closed without having value/expression part
     * If there is an expression (as an attribute) on a tag,
     * extract all the attribute of it, and keep the expression index.
     * attributes array and expressionIndex
     * will later help to identify what attr/prop to apply.
     */
    for (let i = 0, l = strings.length; i < l; i++) {
      const str = strings[i];

      let result;
      let subStrIndex;
      let subEndIndex;

      const pushToTagAttr = () => {
        const subStr = str.substring(subStrIndex || 0, subEndIndex || str.length);

        tagAttrs.push.apply(tagAttrs, extractAttributeName(subStr));
      };

      while ((result = TAG_QUOTE_REGEX.exec(str))) {
        /**
         * Once we find < we assume tag is started and we will keep the tagStarted until we find >.
         * On tag start we reset the tag attributes
         */
        if (result[0] === '<' && !quoteStart) {
          tagStarted = true;
          tagAttrs = [];

          // store index of place where tag is started and reset the tag end string
          subStrIndex = result.index;
          subEndIndex = undefined;
        } else if (result[0] === '"') {
          quoteStart = !quoteStart;
        } else if (tagStarted && result[0] === '>' && !quoteStart) {
          tagStarted = false;
          // store index of place where tag is ending
          subEndIndex = result.index;

          /**
           * if there no subStrIndex it means the current tag has dynamic part
           * Ex: for string: {dynamicPart}class="some-class" >
           */
          if (subStrIndex === undefined) {
            pushToTagAttr();
          }
        }
      }

      /**
       * If a tag has started but not end it means
       * the string is part of a tag which has dynamic attribute
       * ex:
       * 1. {dynamicPart} class="some-class" {dynamicPart}
       * 2. <class="some-class" {dynamicPart}
       */
      // if it has a tag part extract all the attribute names from the string
      if (tagStarted) {
        pushToTagAttr();
      }

      /*
       * Push expression/value metadata to partsMeta,
       * as the expressions value length will be str.length - 1 add check for that.
       */
      if (i < l - 1) {
        partsMeta.push({
          tagAttrs,
          attrIndex: tagAttrs.length,
          /**
           * If tag is started the next expression part will be an attribute spread value
           *  Otherwise it will be a node expression.
           */
          isAttribute: tagStarted,
        });
      }
    }

    return partsMeta;
  }

  createTemplate(isSvgPart: boolean) {
    const { partsMeta, strings } = this;
    const template = document.createElement('template');

    let htmlStr = '';

    for (let i = 0, l = strings.length - 1; i < l; i++) {
      const str = strings[i];
      const part = partsMeta[i];
      const { isAttribute } = part;

      if (isAttribute) {
        htmlStr = htmlStr + str + attrMarker;
      } else {
        htmlStr = htmlStr + str + nodeMarker;
      }
    }

    // add the last string
    htmlStr = htmlStr + strings[strings.length - 1];

    /**
     * if its svg child wrap it inside svg
     * so that inner elements are parsed in svg context
     * Or else add the htmlStr directly
     */
    template.innerHTML = isSvgPart ? `<svg>${htmlStr}</svg>` : htmlStr;

    /**
     * Once added to template unwrap the element from svg wrap
     */
    if (isSvgPart) {
      const { content } = template;

      // $FlowFixMe: In this case there will always have a wrap.
      const svgWrap: SVGElement = content.firstChild;

      // move all children out of the element
      while (svgWrap.firstChild) content.insertBefore(svgWrap.firstChild, svgWrap);

      // remove the empty element
      content.removeChild(svgWrap);
    }

    const templateKey = isSvgPart ? 'svgTemplate' : 'template';

    this[templateKey] = template;
  }
}
