import {
  isTagNode,
  isComponentNode,
  isPrimitiveNode,
  ATTRIBUTE_NODE,
  CLASS_COMPONENT_NODE,
} from './brahmosNode';
import { callLifeCycle, insertBefore, getCurrentNode } from './utils';
import { getTransitionFromFiber } from './transitionUtils';
import { getPendingUpdatesKey } from './updateMetaUtils';
import { runEffects } from './hooks';

import updateNodeAttributes from './updateAttribute';
import { BRAHMOS_DATA_KEY, UPDATE_TYPE_DEFERRED, UPDATE_TYPE_SYNC } from './configs';

/**
 * Updater to handle text node
 */
function updateTextNode(fiber) {
  const { part, node } = fiber;
  const { parentNode, previousSibling, nextSibling } = part;
  /**
   * get the last text node
   * As we always override the text node and don't change the position of
   * text node, Always send nextSibling as null to getCurrentNode
   * So we always pick the text node based on previousSibling
   * or parentNode (if prevSibling is null).
   */
  let textNode = getCurrentNode(parentNode, previousSibling, null);

  if (!textNode) {
    // add nodes at the right location
    textNode = insertBefore(parentNode, nextSibling, node);
  } else {
    // if we have text node just update the text node
    textNode.textContent = node;
  }

  return textNode;
}

function updateExistingNode(nodeInstance, part, oldPart, root) {
  // if it is not a part of array item, no need to rearrange
  if (!part.isArrayNode) return;

  const { domNodes } = nodeInstance;
  const { nodeIndex, parentNode, previousSibling } = part;
  const { nodeIndex: oldNodeIndex } = oldPart;

  // if the item position on last render and current render is same, no need to rearrange
  if (nodeIndex === oldNodeIndex) return;

  // if it is first item append it after the previous sibling or else append it after last rendered element.
  const appendAfter = nodeIndex === 0 ? previousSibling : root.lastArrayDOM;

  // get the element before which we have to add the new node
  const appendBefore = appendAfter ? appendAfter.nextSibling : parentNode.firstChild;

  // if there is dom node and it isn't in correct place rearrange the nodes
  const firstDOMNode = domNodes[0];
  if (
    firstDOMNode &&
    firstDOMNode.previousSibling !== appendAfter &&
    firstDOMNode !== appendBefore
  ) {
    insertBefore(parentNode, appendBefore, domNodes);
  }
}

function updateTagNode(fiber) {
  const { part, nodeInstance, alternate, root } = fiber;
  const { parentNode, nextSibling } = part;

  // if the alternate node is there rearrange the element if required, or else just add the new node
  if (alternate) {
    updateExistingNode(nodeInstance, part, alternate.part, root);
  } else {
    /**
     * when we add nodes first time
     * and we are rendering as fragment it means the fragment might have childNodes
     * which nodeInstance does not have, so for such cases we should reset nodeList on nodeInstance;
     */
    nodeInstance.domNodes = insertBefore(parentNode, nextSibling, nodeInstance.fragment);
  }

  root.lastArrayDOM = nodeInstance.domNodes[nodeInstance.domNodes.length - 1];
}

function handleComponentEffect(fiber) {
  const { node, nodeInstance, root } = fiber;
  const { updateType } = root;
  const { nodeType } = node;
  const brahmosData = nodeInstance[BRAHMOS_DATA_KEY];

  if (nodeType === CLASS_COMPONENT_NODE) {
    const { props: prevProps, state: prevState } = brahmosData.committedValues;

    node.lastSnapshot = callLifeCycle(nodeInstance, 'getSnapshotBeforeUpdate', [
      prevProps,
      prevState,
    ]);
  }

  // remove all the pending updates associated with current transition
  const { transitionId } = getTransitionFromFiber(fiber);
  const pendingUpdatesKey = getPendingUpdatesKey(updateType);
  brahmosData[pendingUpdatesKey] = brahmosData[pendingUpdatesKey].filter(
    (stateMeta) => stateMeta.transitionId !== transitionId,
  );

  // reset isDirty flag
  brahmosData.isDirty = false;

  root.postCommitEffects.push(fiber);
}

function handleComponentPostCommitEffect(fiber) {
  const { node, nodeInstance, root } = fiber;
  const { updateType } = root;

  const { nodeType, lastSnapshot } = node;
  const brahmosData = nodeInstance[BRAHMOS_DATA_KEY];

  if (nodeType === CLASS_COMPONENT_NODE) {
    const { props, state } = nodeInstance;
    const { committedValues } = brahmosData;
    // get the previous state and prevProps
    const { props: prevProps, state: prevState } = committedValues;
    /**
     * if it is first time rendered call componentDidMount or else call componentDidUpdate
     * prevProps will not be available for first time render
     */
    if (!prevProps) {
      callLifeCycle(nodeInstance, 'componentDidMount');
    } else {
      callLifeCycle(nodeInstance, 'componentDidUpdate', [prevProps, prevState, lastSnapshot]);
    }

    // after commit is done set the current prop and state on committed values
    committedValues.props = props;
    committedValues.state = state;
  } else {
    // call effects of functional component
    runEffects(fiber);

    // switch deferred hooks array and syncHooks hooks array, if it is deferred state update
    if (updateType === UPDATE_TYPE_DEFERRED) {
      const { syncHooks, deferredHooks } = nodeInstance;
      nodeInstance.deferredHooks = syncHooks;
      nodeInstance.syncHooks = deferredHooks;
    }
  }

  // mark component as mounted
  brahmosData.mounted = true;

  // add fiber reference on component instance, so the component is aware of its fiber
  brahmosData.fiber = fiber;
}

function handleAttributeEffect(fiber) {
  const { part, node, alternate } = fiber;
  const { domNode } = part;
  const { attributes } = node;
  const oldAttributes = alternate && alternate.node.attributes;

  // TODO: Fix svg case
  updateNodeAttributes(domNode, attributes, oldAttributes, false);

  // Handle value resets
}

export function resetEffectList(root) {
  root.lastEffectFiber = root;
  root.tearDownFibers = [];
  root.postCommitEffects = [];
  root.lastArrayDOM = null;
  root.hasUncommittedEffect = false;

  // reset after render callbacks
  root.resetRenderCallbacks();
}

export function removeTransitionFromRoot(root) {
  const { currentTransition, pendingTransitions } = root;
  const currentTransitionIndex = pendingTransitions.indexOf(currentTransition);
  if (currentTransitionIndex !== -1) {
    pendingTransitions.splice(currentTransitionIndex, 1);
  }
}

function handleFiberEffect(fiber) {
  const { node } = fiber;
  const _isComponentNode = node && isComponentNode(node);

  // if fiber is a component fiber, update the fiber reference in nodeInstance
  if (_isComponentNode) {
    fiber.nodeInstance[BRAHMOS_DATA_KEY].fiber = fiber;
  }

  // if node has uncommitted effect, handle the effect
  if (fiber.hasUncommittedEffect) {
    if (isPrimitiveNode(node)) {
      updateTextNode(fiber);
    } else if (isTagNode(node)) {
      updateTagNode(fiber);
      // TODO: Handle rearrange type of effect
    } else if (_isComponentNode) {
      handleComponentEffect(fiber);
    } else if (node.nodeType === ATTRIBUTE_NODE) {
      handleAttributeEffect(fiber);
    }

    // reset the hasUncommittedEffect flag
    fiber.hasUncommittedEffect = false;
  }
}

export default function effectLoop(root, newFibers) {
  // loop on new fibers hand call if effect needs to be called
  newFibers.forEach(handleFiberEffect);

  const { postCommitEffects } = root;

  // after applying the effects run all the post effects
  for (let i = postCommitEffects.length - 1; i >= 0; i--) {
    handleComponentPostCommitEffect(postCommitEffects[i]);
  }

  // remove the current transition from pending transition
  removeTransitionFromRoot(root);

  // once all effect has been processed update root's last effect node and reset lastArrayDOM and postCommitEffects
  resetEffectList(root);
}
