/*
Copyright 2019 Google Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { autobind } from 'core-decorators';
import FocusTrap from 'focus-trap-react';
import { List, Set } from 'immutable';
import keyboardJS from 'keyboardjs';
import qs from 'query-string';
import React from 'react';
import { RouteComponentProps, withRouter } from 'react-router';
import { Link } from 'react-router-dom';

import {
  CommentScoreModel,
  ICommentModel,
  ICommentScoreModel,
  ICommentSummaryScoreModel,
  ITaggingSensitivityModel,
  ITagModel,
  IUserModel,
  ModelId,
} from '../../../../../models';
import {
  IConfirmationAction,
  IModerationAction,
} from '../../../../../types';
import {
  Arrow,
  ArrowIcon,
  ConfirmationCircle,
  InfoIcon,
  ModerateButtons,
  ReplyIcon,
  ScoresList,
  Scrim,
  SingleComment,
  ToolTip,
} from '../../../../components';
import { REQUIRE_REASON_TO_REJECT } from '../../../../config';
import {
  COMMENTS_EDITABLE_FLAG,
  MODERATOR_GUIDELINES_URL,
  SUBMIT_FEEDBACK_URL,
} from '../../../../config';
import { ICommentCacheProps } from '../../../../injectors/commentFetchQueue';
import { commentInjector } from '../../../../injectors/commentInjector';
import {
  approveComments,
  deferComments,
  deleteCommentTag,
  highlightComments,
  ICommentActionFunction,
  rejectComments,
  resetComments,
  tagComments,
  tagCommentsAnnotation,
  tagCommentSummaryScores,
} from '../../../../stores/commentActions';
import {
  ATTRIBUTES_APPROVED,
  ATTRIBUTES_DEFERRED,
  ATTRIBUTES_HIGHLIGHTED,
  ATTRIBUTES_REJECTED,
  ATTRIBUTES_RESET,
} from '../../../../stores/comments';
import {
  BASE_Z_INDEX,
  BOTTOM_BORDER_TRANSITION,
  BOX_DEFAULT_SPACING,
  BUTTON_LINK_TYPE,
  BUTTON_RESET,
  DARK_COLOR,
  DARK_SECONDARY_TEXT_COLOR,
  DARK_TERTIARY_TEXT_COLOR,
  DIVIDER_COLOR,
  GUTTER_DEFAULT_SPACING,
  HEADER_HEIGHT,
  MEDIUM_COLOR,
  PALE_COLOR,
  SCRIM_STYLE,
  SCRIM_Z_INDEX,
  SELECT_Z_INDEX,
  TEXT_OFFSET_DEFAULT_SPACING,
  VISUALLY_HIDDEN,
  WHITE_COLOR,
} from '../../../../styles';
import { clearReturnSavedCommentRow, partial, setReturnSavedCommentRow, timeout } from '../../../../util';
import { css, stylesheet } from '../../../../utilx';
import {
  commentDetailsPageLink,
  commentRepliesDetailsLink,
  ICommentDetailsPathParams,
  isArticleContext,
  NEW_COMMENTS_DEFAULT_TAG,
  newCommentsPageLink,
} from '../../../routes';
import {
  getReducedScoresAboveThreshold,
  getScoresAboveThreshold,
  getSensitivitiesForCategory,
} from '../../scoreFilters';
import { Shortcuts } from '../Shortcuts';

const actionMap: {
  [key: string]: ICommentActionFunction;
} = {
  highlight: highlightComments,
  approve: approveComments,
  defer: deferComments,
  reject: rejectComments,
  reset: resetComments,
};

const COMMENT_WRAPPER_WIDTH = 696;
const KEYBOARD_SHORTCUTS_POPUP_ID = 'keyboard-shortcuts';
const SCORES_POPUP_ID = 'scores-popup';
const CONFIRMATION_POPUP_ID = 'confirmation-popup';
const INFO_DROPDOWN_ID = 'info-dropdown';
const APPROVE_SHORTCUT = 'alt + a';
const REJECT_SHORTCUT = 'alt + r';
const DEFER_SHORTCUT = 'alt + d';
const HIGHLIGHT_SHORTCUT = 'alt + h';
const ESCAPE_SHORTCUT = 'escape';
const PREV_SHORTCUT = 'alt + up';
const NEXT_SHORTCUT = 'alt + down';

const STYLES = stylesheet({
  wrapper: {
    height: '100%',
  },

  commentWrapper: {
    display: 'flex',
    position: 'relative',
    boxSizing: 'border-box',
    padding: '0 142px 0 76px',
    height: '100%',
    overflowY: 'scroll',
  },

  comment: {
    padding: `${TEXT_OFFSET_DEFAULT_SPACING}px 0`,
    width: '100%',
    maxWidth: `${COMMENT_WRAPPER_WIDTH}px`,
    margin: '0 auto',
  },

  sidebar: {
    position: 'fixed',
    display: 'flex',
    top: HEADER_HEIGHT,
    bottom: 10,
    right: GUTTER_DEFAULT_SPACING,
    zIndex: SELECT_Z_INDEX,
  },

  buttons: {
    alignSelf: 'center',
  },

  pagers: {
    width: '58px',
    position: 'absolute',
    bottom: '0px',
    right: '0px',
  },

  popup: {
    ...SCRIM_STYLE.popup,
    width: '100%',
    minWidth: '500px',
    maxHeight: '600px',
  },

  infoTrigger: {
    position: 'fixed',
    bottom: '24px',
    left: '24px',
    background: 'none',
    border: '0px',
    cursor: 'pointer',
    ':focus': {
      outline: 0,
    },
  },

  infoList: {
    listStyle: 'none',
    padding: '5px',
    width: '200px',
  },

  infoTooltipButton: {
    ...BUTTON_LINK_TYPE,
    width: '100%',
    textAlign: 'left',
    paddingLeft: `${BOX_DEFAULT_SPACING}px`,
    paddingRight: `${BOX_DEFAULT_SPACING}px`,
    background: 'none',
    border: '0px',
    color: DARK_COLOR,
    cursor: 'pointer',
  },

  scrim: {
    zIndex: SCRIM_Z_INDEX,
  },

  scrim1: {
    zIndex: BASE_Z_INDEX,
  },

  subHeading: {
    ...BUTTON_RESET,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    background: PALE_COLOR,
    height: HEADER_HEIGHT,
    paddingLeft: GUTTER_DEFAULT_SPACING,
    paddingRight: GUTTER_DEFAULT_SPACING,
    position: 'absolute',
    width: '100%',
    zIndex: BASE_Z_INDEX,
    textDecoration: 'none',
    ':focus': {
      outline: 0,
      textDecoration: 'underline',
    },
  },

  selectedInfo: {
    ...BOTTOM_BORDER_TRANSITION,
    marginLeft: GUTTER_DEFAULT_SPACING,
    color: DARK_COLOR,
  },

  replyButton: {
    border: 'none',
    backgroundColor: 'transparent',
    color: DARK_COLOR,
    ':focus': {
      outline: 0,
      textDecoration: 'underline',
    },
  },

  replyIcon: {
    marginRight: `${BOX_DEFAULT_SPACING}px`,
    display: 'inline-block',
    transform: 'translateY(-4px)',
  },

  loadIcon: {
    fill: DARK_COLOR,
    display: 'flex',
    margin: '50% auto 0 auto',
  },

  replyToContainer: {
    borderBottom: `2px solid ${DIVIDER_COLOR}`,
    height: HEADER_HEIGHT,
    display: 'flex',
    alignItems: 'center',
  },

  resultsHeader: {
    alignItems: 'center',
    backgroundColor: PALE_COLOR,
    color: MEDIUM_COLOR,
    display: 'flex',
    flexWrap: 'no-wrap',
    justifyContent: 'space-between',
  },

  resultsHeadline: {
    marginLeft: '29px',
  },

  resultsLink: {
    color: MEDIUM_COLOR,
    cursor: 'pointer',
  },

  paginationArrow: {
    display: 'block',
    ':focus': {
      outline: 0,
      textDecoration: 'underline,',
    },
  },

  confirmationPopup: {
    ':focus': {
      outline: 0,
    },
  },
});

interface IReplyLinkProps extends RouteComponentProps<ICommentDetailsPathParams>, ICommentCacheProps {
  commentId: ModelId;
  parent: ICommentModel;
}

function _ReplyLink(props: IReplyLinkProps) {
  const comment = props.comment;
  return (
    <div {...css(STYLES.replyToContainer)}>
      <Link
        to={commentRepliesDetailsLink({
          context: props.match.params.context,
          contextId: props.match.params.contextId,
          commentId: comment.id,
          originatingCommentId: props.parent.id,
        })}
        {...css(STYLES.replyButton)}
      >
        <div {...css(STYLES.replyIcon)}>
          <ReplyIcon {...css({fill: DARK_COLOR})} size={24} />
        </div>
        This is a reply to {comment.author && comment.author.name}
      </Link>
    </div>
  );
}

const ReplyLink = withRouter(commentInjector(_ReplyLink));

export interface ICommentDetailProps extends RouteComponentProps<ICommentDetailsPathParams> {
  comment: ICommentModel;
  availableTags: List<ITagModel>;
  allScores?: Array<ICommentScoreModel>;
  taggingSensitivities: List<ITaggingSensitivityModel>;
  currentCommentIndex?: number;
  nextCommentId?: string;
  previousCommentId?: string;
  isFromBatch?: boolean;
  onUpdateCommentScore?(commentScore: ICommentScoreModel): void;
  onUpdateComment?(comment: ICommentModel): void;
  onAddCommentScore?(commentScore: ICommentScoreModel): void;
  onRemoveCommentScore?(commentScore: ICommentScoreModel): void;
  loadData?(commentId: string): void;
  loadScores?(commentId: string): void;
  onCommentAction?(action: IConfirmationAction, idsToDispatch: Array<string>): void;
  getUserById?(id: string | number): IUserModel;
  currentUser: IUserModel;
  detailSource?: string;
  linkBackToList?: string;
}

export interface ICommentDetailState {
  taggingSensitivitiesInCategory?: List<ITaggingSensitivityModel>;
  allScoresAboveThreshold?: Array<ICommentScoreModel>;
  reducedScoresAboveThreshold?: Array<ICommentScoreModel>;
  loadedCommentId?: string;
  isKeyboardModalVisible?: boolean;
  isConfirmationModalVisible?: boolean;
  isScoresModalVisible?: boolean;
  scoresSelectedByTag?: Array<ICommentScoreModel>;
  thresholdByTag?: ITaggingSensitivityModel;
  confirmationAction?: IConfirmationAction;
  isInfoDropdownVisible?: boolean;
  infoToolTipPosition?: {
    top: number,
    left: number,
  };
  upArrowIsFocused?: boolean;
  downArrowIsFocused?: boolean;
  infoIconFocused?: boolean;
  selectedRow?: number;
  taggingCommentId?: string;
}

export class CommentDetail extends React.Component<ICommentDetailProps, ICommentDetailState> {

  state: ICommentDetailState = {
    isKeyboardModalVisible: false,
    isConfirmationModalVisible: false,
    confirmationAction: null,
    isInfoDropdownVisible: false,
    isScoresModalVisible: false,
    scoresSelectedByTag: null,
    thresholdByTag: null,
    infoToolTipPosition: {
      top: 0,
      left: 0,
    },
    upArrowIsFocused: false,
    downArrowIsFocused: false,
    infoIconFocused: false,
    taggingCommentId: null,
  };

  buttonRef: HTMLElement = null;

  componentDidMount() {
    this.attachEvents();
  }

  componentWillUnmount() {
    this.detachEvents();
  }

  static getDerivedStateFromProps(nextProps: ICommentDetailProps, prevState: ICommentDetailState) {
    const categoryId = (nextProps.comment && nextProps.comment.categoryId) || 'na';
    const sensitivities = getSensitivitiesForCategory(categoryId, nextProps.taggingSensitivities);

    const allScoresAboveThreshold = getScoresAboveThreshold(sensitivities, nextProps.allScores);
    const reducedScoresAboveThreshold = getReducedScoresAboveThreshold(sensitivities, nextProps.allScores);

    if (prevState.loadedCommentId !== nextProps.match.params.commentId) {
      nextProps.loadData(nextProps.match.params.commentId);
    }

    return {
      taggingSensitivitiesInCategory: sensitivities,
      allScoresAboveThreshold,
      reducedScoresAboveThreshold,
      loadedCommentId: nextProps.match.params.commentId,
    };
  }

  @autobind
  onFocusUpArrow() {
    this.setState({ upArrowIsFocused: true });
  }

  @autobind
  onBlurUpArrow() {
    this.setState({ upArrowIsFocused: false });
  }

  @autobind
  onFocusDownArrow() {
    this.setState({ downArrowIsFocused: true });
  }

  @autobind
  onBlurDownArrow() {
    this.setState({ downArrowIsFocused: false });
  }

  @autobind
  onFocusInfoIcon() {
    this.setState({ infoIconFocused: true });
  }

  @autobind
  onBlurInfoIcon() {
    this.setState({ infoIconFocused: false });
  }

  @autobind
  saveButtonRef(ref: HTMLButtonElement) {
    this.buttonRef = ref;
  }

  @autobind
  saveReturnRow(commentId: string): void {
    setReturnSavedCommentRow(commentId);
  }

  @autobind
  async handleAssignTagsSubmit(commentId: ModelId, selectedTagIds: Set<ModelId>) {
    selectedTagIds.forEach((tagId) => {
      tagCommentSummaryScores([commentId], tagId);
    });
    this.moderateComment('reject');
    this.setState({
      taggingCommentId: null,
    });
  }

  render() {
    const {
      comment,
      availableTags,
      allScores,
      currentCommentIndex,
      nextCommentId,
      previousCommentId,
      loadScores,
      onUpdateCommentScore,
      onRemoveCommentScore,
      getUserById,
      detailSource,
      linkBackToList,
      currentUser,
      onUpdateComment,
      match: {params},
    } = this.props;

    const {
      allScoresAboveThreshold,
      reducedScoresAboveThreshold,
      isKeyboardModalVisible,
      isConfirmationModalVisible,
      isScoresModalVisible,
      scoresSelectedByTag,
      thresholdByTag,
      confirmationAction,
      isInfoDropdownVisible,
      infoToolTipPosition,
      upArrowIsFocused,
      downArrowIsFocused,
      infoIconFocused,
    } = this.state;

    if (!comment) {
      return null;
    }

    const activeButtons = this.getActiveButtons(this.props.comment);

    const batchURL = newCommentsPageLink({
      context: params.context,
      contextId: params.contextId,
      tag: NEW_COMMENTS_DEFAULT_TAG,
    });

    return (
      <div {...css({ height: '100%' })}>
        <div>
          { detailSource && (typeof currentCommentIndex === 'number') ? (
            <Link to={linkBackToList} {...css(STYLES.subHeading)}>
              <ArrowIcon direction="left" {...css({fill: DARK_COLOR, margin: 'auto 0'})} size={24} />
              <p {...css(STYLES.selectedInfo)}>
                {detailSource.replace('%i', (currentCommentIndex + 1).toString())}
              </p>
            </Link>
          ) : (
            <Link to={batchURL} {...css(STYLES.subHeading)}>
              <ArrowIcon direction="left" {...css({fill: DARK_COLOR, margin: 'auto 0'})} size={24} />
              <p {...css(STYLES.selectedInfo)}>
                {`Back to ${isArticleContext(params) ? 'article' : 'category'}`}
              </p>
            </Link>
          )}
        </div>

        <div {...css(STYLES.wrapper)}>
          <div {...css(STYLES.sidebar)}>
            <div {...css(STYLES.buttons)}>
              <ModerateButtons
                vertical
                activeButtons={activeButtons}
                onClick={this.moderateComment}
                requireReasonForReject={comment.isAccepted === false ? false : REQUIRE_REASON_TO_REJECT}
                comment={comment}
                handleAssignTagsSubmit={this.handleAssignTagsSubmit}
              />
            </div>
            { (previousCommentId || nextCommentId) && (
              <div {...css(STYLES.pagers)}>
                { previousCommentId ? (
                  <Link
                    {...css(STYLES.paginationArrow)}
                    to={this.generatePagingLink(previousCommentId)}
                    onFocus={this.onFocusUpArrow}
                    onBlur={this.onBlurUpArrow}
                    onClick={partial(this.saveReturnRow, previousCommentId)}
                  >
                    <Arrow
                      direction={'up'}
                      label={'up arrow'}
                      size={58}
                      color={upArrowIsFocused ? MEDIUM_COLOR : DARK_TERTIARY_TEXT_COLOR}
                      icon={<ArrowIcon {...css({ fill: upArrowIsFocused ? MEDIUM_COLOR : DARK_TERTIARY_TEXT_COLOR })} size={24} />}
                    />
                    <span {...css(VISUALLY_HIDDEN)}>Previous Comment</span>
                  </Link>
                ) : (
                  <Arrow
                    isDisabled
                    direction={'up'}
                    label={'up arrow'}
                    size={58}
                    color={DARK_TERTIARY_TEXT_COLOR}
                    icon={<ArrowIcon {...css({ fill: DARK_TERTIARY_TEXT_COLOR })} size={24} />}
                  />
                )}

                { nextCommentId ? (
                  <Link
                    {...css(STYLES.paginationArrow)}
                    to={this.generatePagingLink(nextCommentId)}
                    onFocus={this.onFocusDownArrow}
                    onBlur={this.onBlurDownArrow}
                    onClick={partial(this.saveReturnRow, nextCommentId)}
                  >
                    <Arrow
                      direction={'down'}
                      label={'down arrow'}
                      size={58}
                      color={upArrowIsFocused ? MEDIUM_COLOR : DARK_TERTIARY_TEXT_COLOR}
                      icon={<ArrowIcon {...css({ fill: downArrowIsFocused ? MEDIUM_COLOR : DARK_TERTIARY_TEXT_COLOR })} size={24} />}
                    />
                    <span {...css(VISUALLY_HIDDEN)}>Next Comment</span>
                  </Link>
                ) : (
                  <Arrow
                    isDisabled
                    direction={'down'}
                    label={'down arrow'}
                    size={58}
                    color={DARK_TERTIARY_TEXT_COLOR}
                    icon={<ArrowIcon {...css({fill: DARK_TERTIARY_TEXT_COLOR})} size={24} />}
                  />
                )}
              </div>
            )}
          </div>

          <div {...css(STYLES.commentWrapper)}>
            <div {...css(STYLES.comment)}>
              { comment.replyId && (
                <ReplyLink parent={comment} commentId={comment.replyId}/>
              )}
              <SingleComment
                comment={comment}
                allScores={allScores}
                allScoresAboveThreshold={allScoresAboveThreshold}
                reducedScoresAboveThreshold={reducedScoresAboveThreshold}
                availableTags={availableTags}
                loadScores={loadScores}
                getUserById={getUserById}
                onScoreClick={this.handleScoreClick}
                onTagButtonClick={this.onTagButtonClick}
                onCommentTagClick={this.onCommentTagClick}
                onAnnotateTagButtonClick={this.onAnnotateTagButtonClick}
                onDeleteCommentTag={deleteCommentTag}
                onRemoveCommentScore={onRemoveCommentScore}
                onUpdateCommentScore={onUpdateCommentScore}
                currentUser={currentUser}
                onUpdateCommentText={onUpdateComment}
                commentEditingEnabled={COMMENTS_EDITABLE_FLAG}
              />
            </div>
          </div>

          <Scrim
            key="keyboardScrim"
            scrimStyles={{...STYLES.scrim, ...SCRIM_STYLE.scrim}}
            isVisible={isKeyboardModalVisible}
            onBackgroundClick={this.onKeyboardClose}
          >
            <FocusTrap
              focusTrapOptions={{
                clickOutsideDeactivates: true,
              }}
            >
              <div key="keyboardContainer" id={KEYBOARD_SHORTCUTS_POPUP_ID} {...css(STYLES.popup)}>
                {/* keyboard shortcuts */}
                <Shortcuts onClose={this.onKeyboardClose}/>
              </div>
            </FocusTrap>
          </Scrim>

          <Scrim
            key="confirmationScrim"
            scrimStyles={{...STYLES.scrim, ...SCRIM_STYLE.scrim}}
            isVisible={isConfirmationModalVisible}
            onBackgroundClick={this.closeToast}
          >
            <div id={CONFIRMATION_POPUP_ID} tabIndex={0} {...css(STYLES.confirmationPopup)}>
              {/* Confirmation popup */}
              <ConfirmationCircle backgroundColor={DARK_COLOR} action={confirmationAction} size={120} iconSize={40} />
            </div>
          </Scrim>

          {/* ToolTip and Scrim */}
          <Scrim
            key="tooltipScrim"
            scrimStyles={STYLES.scrim1}
            isVisible={isInfoDropdownVisible}
            onBackgroundClick={this.onDropdownClose}
            id={INFO_DROPDOWN_ID}
          >
            <ToolTip
              hasDropShadow
              backgroundColor={WHITE_COLOR}
              arrowPosition="leftBottom"
              size={16}
              isVisible={isInfoDropdownVisible}
              position={infoToolTipPosition}
              zIndex={SCRIM_Z_INDEX}
            >
              <ul {...css(STYLES.infoList)}>
                <li>
                  <button
                    {...css(STYLES.infoTooltipButton)}
                    onClick={this.onKeyboardOpen}
                  >
                    Keyboard Shortcuts
                  </button>
                </li>
                {MODERATOR_GUIDELINES_URL && (
                  <li>
                    <a
                      {...css(STYLES.infoTooltipButton)}
                      href={MODERATOR_GUIDELINES_URL}
                      target="_blank"
                    >
                      Moderator Guidelines
                    </a>
                  </li>
                )}
                {SUBMIT_FEEDBACK_URL && (
                  <li>
                    <a
                      {...css(STYLES.infoTooltipButton)}
                      href={SUBMIT_FEEDBACK_URL}
                      target="_blank"
                    >
                      Submit Feedback
                    </a>
                  </li>
                )}
              </ul>
            </ToolTip>
          </Scrim>
          <button
            tabIndex={0}
            ref={this.saveButtonRef}
            {...css(STYLES.infoTrigger)}
            onClick={this.onDropdownOpen}
            onFocus={this.onFocusInfoIcon}
            onBlur={this.onBlurInfoIcon}
          >
            <InfoIcon {...css({fill: infoIconFocused ? MEDIUM_COLOR : DARK_SECONDARY_TEXT_COLOR})} />
            <span {...css(VISUALLY_HIDDEN)}>Tag Information</span>
          </button>
        </div>

        <Scrim
          key="scoresScrim"
          scrimStyles={{...STYLES.scrim, ...SCRIM_STYLE.scrim}}
          isVisible={isScoresModalVisible}
          onBackgroundClick={this.onScoresModalClose}
        >
          <FocusTrap
            focusTrapOptions={{
              clickOutsideDeactivates: true,
            }}
          >
            <div
              key="scoresContainer"
              id={SCORES_POPUP_ID}
              {...css(
                STYLES.popup,
                { width: `${COMMENT_WRAPPER_WIDTH}px` },
              )}
            >
              {/* All scores popup */}
              <ScoresList
                comment={comment}
                scores={scoresSelectedByTag}
                threshold={thresholdByTag}
                onClose={this.onScoresModalClose}
              />
            </div>
          </FocusTrap>
        </Scrim>
      </div>
    );
  }

  generatePagingLink(commentId: string) {
    const pagingIdentifier: string = qs.parse(this.props.location.search).pagingIdentifier as string;
    const params = this.props.match.params;
    const urlParams = {
      context: params.context,
      contextId: params.contextId,
      commentId,
    };
    const query = pagingIdentifier && {pagingIdentifier};
    return commentDetailsPageLink(urlParams, query);
  }

  @autobind
  calculateInfoTrigger(ref: any) {
    if (!ref) {
      return;
    }

    const infoIconRect = ref.getBoundingClientRect();

    this.setState({
      infoToolTipPosition: {
        // get height of tooltip, use that to offset
        top: (infoIconRect.bottom - 24),
        left: infoIconRect.right,
      },
    });
  }

  @autobind
  onResize() {
    this.calculateInfoTrigger(this.buttonRef);
  }

  @autobind
  onKeyboardOpen() {
    this.setState({ isKeyboardModalVisible: true });
  }

  @autobind
  onKeyboardClose() {
    this.setState({ isKeyboardModalVisible: false });
  }

  @autobind
  onDropdownOpen() {
    this.setState({ isInfoDropdownVisible: true });
    this.calculateInfoTrigger(this.buttonRef);
  }

  @autobind
  onDropdownClose() {
    this.setState({ isInfoDropdownVisible: false });
  }

  @autobind
  onScoresModalClose() {
    this.setState({ isScoresModalVisible: false });
  }

  @autobind
  attachEvents() {
    keyboardJS.bind(APPROVE_SHORTCUT, this.approveComment);
    keyboardJS.bind(REJECT_SHORTCUT, this.rejectComment);
    keyboardJS.bind(DEFER_SHORTCUT, this.deferComment);
    keyboardJS.bind(HIGHLIGHT_SHORTCUT, this.highlightComment);
    keyboardJS.bind(ESCAPE_SHORTCUT, this.onPressEscape);
    keyboardJS.bind(PREV_SHORTCUT, this.goToPrevComment);
    keyboardJS.bind(NEXT_SHORTCUT, this.goToNextComment);

    window.addEventListener('resize', this.onResize);
  }

  @autobind
  detachEvents() {
    keyboardJS.unbind(APPROVE_SHORTCUT, this.approveComment);
    keyboardJS.unbind(REJECT_SHORTCUT, this.rejectComment);
    keyboardJS.unbind(DEFER_SHORTCUT, this.deferComment);
    keyboardJS.unbind(HIGHLIGHT_SHORTCUT, this.highlightComment);
    keyboardJS.unbind(ESCAPE_SHORTCUT, this.onPressEscape);
    keyboardJS.unbind(PREV_SHORTCUT, this.goToPrevComment);
    keyboardJS.unbind(NEXT_SHORTCUT, this.goToNextComment);
    window.removeEventListener('resize', this.onResize);
  }

  getChangeByAction(action: IConfirmationAction): ICommentModel {
    const { comment } = this.props;

    if (action === 'reset') {
      return {
        ...comment,
        ...ATTRIBUTES_RESET,
      };
    }

    if (action === 'highlight') {
      return {
        ...comment,
        ...ATTRIBUTES_HIGHLIGHTED,
      };
    }

    if (action === 'approve') {
      return {
        ...comment,
        ...ATTRIBUTES_APPROVED,
      };
    }

    if (action === 'reject') {
      return {
        ...comment,
        ...ATTRIBUTES_REJECTED,
      };
    }

    if (action === 'defer') {
      return {
        ...comment,
        ...ATTRIBUTES_DEFERRED,
      };
    }
    return comment;
  }

  @autobind
  onBackClick() {
    window.history.back();
  }

  @autobind
  async moderateComment(action: IModerationAction) {
    const activeButtons = this.getActiveButtons(this.props.comment);
    const shouldResetAction = activeButtons.includes(action);
    const commentAction: IConfirmationAction = shouldResetAction ? 'reset' : action;
    this.setState({
      isConfirmationModalVisible: true,
      confirmationAction: commentAction,
    });
    if (this.props.onUpdateComment) {
      await this.props.onUpdateComment(this.getChangeByAction(commentAction));
    }

    await actionMap[commentAction]([this.props.comment.id]);
    await Promise.all([
      this.props.onCommentAction && this.props.onCommentAction(commentAction, [this.props.comment.id]),
      timeout(2000),
    ]);

    if (this.props.loadScores) {
      await this.props.loadScores(this.props.comment.id);
    }

    this.closeToast();

    // clear saved for batch view, since this one has now been moderated.
    clearReturnSavedCommentRow();

    if (this.props.isFromBatch) {
      this.goToNextComment();
    }
  }

  @autobind
  approveComment() {
    return this.moderateComment('approve');
  }

  @autobind
  rejectComment() {
    return this.moderateComment('reject');
  }

  @autobind
  deferComment() {
    return this.moderateComment('defer');
  }

  @autobind
  highlightComment() {
    return this.moderateComment('highlight');
  }

  @autobind
  goToPrevComment() {
    const { previousCommentId } = this.props;

    if (!previousCommentId) {
      return;
    }

    this.saveReturnRow(previousCommentId);
    this.props.history.push(this.generatePagingLink(previousCommentId));
  }

  @autobind
  goToNextComment() {
    const { nextCommentId } = this.props;

    if (!nextCommentId) {
      return;
    }

    this.saveReturnRow(nextCommentId);
    this.props.history.push(this.generatePagingLink(nextCommentId));
  }

  @autobind
  async onTagButtonClick(tagId: string) {
    const localStatePayload = CommentScoreModel({
      id: null,
      commentId: this.props.comment.id,
      isConfirmed: true,
      sourceType: 'Moderator',
      score: 1,
      tagId,
    });

    if (this.props.onAddCommentScore) {
      await this.props.onAddCommentScore(localStatePayload);
    }
    await tagComments([this.props.comment.id], tagId);
    await this.props.loadScores(this.props.comment.id);
    this.closeToast();
  }

  @autobind
  async onAnnotateTagButtonClick(tag: string, start: number, end: number): Promise<any> {

    const localStatePayload = CommentScoreModel({
      id: null,
      commentId: this.props.comment.id,
      confirmedUserId: this.props.currentUser.id,
      isConfirmed: true,
      tagId: tag,
      annotationStart: start,
      annotationEnd: end,
      sourceType: 'Moderator',
      score: 1,
    });

    if (this.props.onAddCommentScore) {
      await this.props.onAddCommentScore(localStatePayload);
    }

    await tagCommentsAnnotation(this.props.comment.id, tag, start, end);
    await this.props.loadScores(this.props.comment.id);

    this.closeToast();
  }

  @autobind
  async onCommentTagClick(commentScore: ICommentScoreModel) {
    if (this.props.onRemoveCommentScore) {
      await this.props.onRemoveCommentScore(commentScore);
    }

    await deleteCommentTag(this.props.comment.id, commentScore.id);
    this.closeToast();
  }

  @autobind
  closeToast() {
    this.setState({isConfirmationModalVisible: false});
  }

  getActiveButtons(comment: ICommentModel): List<IModerationAction> {
    if (!comment) {
      return null;
    }
    let activeButtons = List();

    if (comment.isAccepted === true) {
      activeButtons = List(['approve']);
    }
    if (comment.isAccepted === false) {
      activeButtons = List(['reject']);
    }
    if (comment.isHighlighted) {
      activeButtons = activeButtons.push('highlight');
    }
    if (comment.isDeferred) {
      activeButtons = List(['defer']);
    }

    return activeButtons as List<IModerationAction>;
  }

  @autobind
  handleScoreClick(scoreClicked: ICommentSummaryScoreModel) {
    const thresholdByTag = this.state.taggingSensitivitiesInCategory.find(
      (ts) => ts.tagId === scoreClicked.tagId || ts.categoryId === null);
    const scoresSelectedByTag = this.props.allScores.filter(
      (score) => score.tagId === scoreClicked.tagId,
    ).sort((a, b) => b.score - a.score);

    this.setState({
      isScoresModalVisible: true,
      scoresSelectedByTag,
      thresholdByTag,
    });
  }

  @autobind
  onPressEscape() {
    if (this.state.isKeyboardModalVisible) {
      this.onKeyboardClose();
    }

    if (this.state.isInfoDropdownVisible) {
      this.onDropdownClose();
    }

    if (this.state.isScoresModalVisible) {
      this.onScoresModalClose();
    }
  }
}
