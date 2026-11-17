import React, { useState, useCallback, useEffect, useRef } from 'react';
import { TokenAnimContext, AdjustInfluenceContext, HighlightCardContext, SmallTokensContext, TokenPopupContext, MstTokenColorContext, ClashSelectionContext } from './CardObject';
import TokenPopup from './TokenPopup';
import PlayerZone from './PlayerZone';
import GameSidebar from './GameSidebar';
import RearguardSection from './RearguardSection';
import GlobalToolsBar from './GlobalToolsBar';
import OpponentInfoBar from './OpponentInfoBar';
import BattlefieldColumn from './BattlefieldColumn';
import ClashSides from './ClashSides';
import WideView from './WideView';
import { useResourceAnimations } from './hooks/useResourceAnimations';
import { useTokenAnimations } from './hooks/useTokenAnimations';
import { useArrowDrag } from './hooks/useArrowDrag';
import { useCardInteractions } from './hooks/useCardInteractions';
import { useRemoteAnimations } from './hooks/useRemoteAnimations';
import { useCardMovements } from './hooks/useCardMovements';
import { useBfMoveAnimations } from './hooks/useBfMoveAnimations';
import { useBfAnimations } from './hooks/useBfAnimations';
import { useAILogic } from './hooks/useAILogic';
import ToolsDialog from './ToolsDialog';
import { ZoomHoverProvider } from './ZoomHoverPopup';
import IncomeOptionsDialog from './IncomeOptionsDialog';
import BattlefieldSplitDialog from './BattlefieldSplitDialog';
import IncomeSelectDialog from './IncomeSelectDialog';
import { clone, removeCardById } from './gameUtils';
import { isStructureEntry } from '@/lib/folderPreview';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { DEFAULT_HOTKEYS } from '@/lib/hotkeys';

const RUN_ICON_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/a0eaf5cb77_188e5e7b1_run.png';
const BLEEDING_EYE_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/bfc4c0e254_d8e945317_bleeding-eye1.png';
const DICE_ICONS = [
  'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/31e76e29f3_84024106b_dice-six-faces-one.png',
  'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/b45bbb12f8_1a05bb9e7_dice-six-faces-two.png',
  'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/84a6948d53_6b018b098_dice-six-faces-three.png',
];

export default function GameTable({ game, entries, supertypes, folderEntries, foghollowColor, myPlayerIndex, updateGame, updateCoordination, updateState, updatePlayers, updateZones }) {
  const navigate = useNavigate();
  const [selection, setSelection] = useState(null);
  const [group, setGroup] = useState([]);
  const [adjustInfluence, setAdjustInfluence] = useState({ clash: true, rearguard: true, hand: true });
  const [smallTokens, setSmallTokens] = useState(true);
  const [zoomHover, setZoomHover] = useState(true);
  const [instantZoomHover, setInstantZoomHover] = useState(true);
  const [ownAnimations, setOwnAnimations] = useState(false);
  const [zoomScale, setZoomScale] = useState(3.5);
  const [rallyToggle, setRallyToggle] = useState(true);
  const prefsLoadedRef = useRef(false);
  const saveTimerRef = useRef(null);
  const [showToolsDialog, setShowToolsDialog] = useState(false);
  const [eyePhase, setEyePhase] = useState('hidden');
  const [diceOverlay, setDiceOverlay] = useState(null);
  const [toolToggles, setToolToggles] = useState({ income: true, dice: true, random: true, wideView: false });
  const [wideViewOn, setWideViewOn] = useState(true);
  const [hotkeys, setHotkeys] = useState(DEFAULT_HOTKEYS);
  const [showIncomePopup, setShowIncomePopup] = useState(false);
  const [randomMode, setRandomMode] = useState(false);
  const [highlightCardId, setHighlightCardId] = useState(null);
  const [tokenPopup, setTokenPopup] = useState(null);
  const localUpdateRef = useRef(false);
  const wrappedUpdateState = useCallback((u) => { localUpdateRef.current = true; updateState(u); }, [updateState]);
  const wrappedUpdatePlayers = useCallback((u) => { localUpdateRef.current = true; updatePlayers(u); }, [updatePlayers]);
  const wrappedUpdateGame = useCallback((u) => { localUpdateRef.current = true; updateGame(u); }, [updateGame]);
  const wrappedUpdateCoordination = useCallback((u) => { localUpdateRef.current = true; updateCoordination(u); }, [updateCoordination]);
  const wrappedUpdateZones = useCallback((updater, zones, opts) => { localUpdateRef.current = true; updateZones(updater, zones, opts); }, [updateZones]);
  const toggleNewZone = useCallback(() => {
    wrappedUpdateZones((s) => {
      const ns = { ...s, new_zone_enabled: clone(s.new_zone_enabled) || [false, false] };
      ns.new_zone_enabled[myPlayerIndex] = !ns.new_zone_enabled[myPlayerIndex];
      return ns;
    }, ['new_zone_enabled']);
  }, [wrappedUpdateZones, myPlayerIndex]);

  // Reset rally toggle to ON at the start of each round
  useEffect(() => { setRallyToggle(true); }, [game.round]);

  // Load persisted play preferences (tools toggles + zoom hover settings)
  // from the user's account so they carry across every game they play.
  useEffect(() => {
    base44.auth.me().then((u) => {
      const p = u?.play_preferences;
      if (p) {
        if (p.adjustInfluence) setAdjustInfluence(p.adjustInfluence);
        if (typeof p.smallTokens === 'boolean') setSmallTokens(p.smallTokens);
        if (typeof p.zoomHover === 'boolean') setZoomHover(p.zoomHover);
        if (typeof p.instantZoomHover === 'boolean') setInstantZoomHover(p.instantZoomHover);
        if (typeof p.ownAnimations === 'boolean') setOwnAnimations(p.ownAnimations);
        if (typeof p.zoomScale === 'number') setZoomScale(p.zoomScale);
        if (p.toolToggles) setToolToggles(p.toolToggles);
      }
      if (u?.hotkey_bindings) setHotkeys({ ...DEFAULT_HOTKEYS, ...u.hotkey_bindings });
      prefsLoadedRef.current = true;
    }).catch(() => { prefsLoadedRef.current = true; });
  }, []);

  // Persist play preferences (debounced) whenever they change.
  useEffect(() => {
    if (!prefsLoadedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      base44.auth.updateMe({ play_preferences: { adjustInfluence, smallTokens, zoomHover, instantZoomHover, ownAnimations, zoomScale, toolToggles }, hotkey_bindings: hotkeys }).catch(console.error);
    }, 500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [adjustInfluence, smallTokens, zoomHover, instantZoomHover, ownAnimations, zoomScale, toolToggles, hotkeys]);

  const state = game.state || {};
  const players = game.players || [];
  const N = players.length;
  const isThreePlayer = N >= 3;
  const me = players[myPlayerIndex];
  const opponentIndices = players.map((_, i) => i).filter((i) => i !== myPlayerIndex);
  // Participant indices derived from the SHARED state (not displayState) to
  // avoid a circular dependency with the pending-state system below.
  const sharedActiveBf = (state.battlefields || []).find((b) => b.id === state.clash?.battlefield_id);
  const participantIndices = sharedActiveBf
    ? (sharedActiveBf.owner === -1 || sharedActiveBf.owner === undefined
        ? players.map((_, i) => i)
        : [sharedActiveBf.owner, sharedActiveBf.viewer].filter((v) => v >= 0))
    : [];

  // The whole clash lifecycle lives in state.clash, so displayState is just the shared state.
  const displayState = state;

  const myRearguard = displayState.rearguards?.[myPlayerIndex] || [];
  const rawBfs = displayState.battlefields || [];
  // Each player sees only 5 battlefields: their 2 (bottom), the neutral 12
  // (middle), and one from each opponent (top — the battlefield whose viewer
  // is this player). In 2p both opponent battlefields have viewer === me.
  const battlefields = [
    ...rawBfs.filter((b) => opponentIndices.includes(b.owner) && b.viewer === myPlayerIndex),
    ...rawBfs.filter((b) => b.owner === -1 || b.owner === undefined),
    ...rawBfs.filter((b) => b.owner === myPlayerIndex),
  ];
  const activeBfId = state.clash?.battlefield_id;
  const activeBf = battlefields.find((b) => b.id === activeBfId);
  const focusedBfId = activeBfId || (selection?.type === 'battlefield' ? selection.battlefield_id : null);
  // 3-player pile labels use opponent names; 2-player uses generic area names.
  const pileLabels = isThreePlayer
    ? opponentIndices.map((oi) => players[oi]?.user_name || 'Opponent')
    : ['Area 1', 'Area 2'];
  const selectedCardId = selection?.type === 'card' ? selection.card_id : null;
  const groupIds = group.length > 0 ? group : null;

  // Eye overlay: large in center for 1.5s, then shrinks to the top bar
  // where it stays until the opponent shuffles their deck
  const deckViewingTs = opponentIndices.reduce((max, oi) => Math.max(max, state.deck_viewing?.[oi] || 0), 0);
  useEffect(() => {
    if (!deckViewingTs) {
      setEyePhase('hidden');
      return;
    }
    setEyePhase('center');
    const timer = setTimeout(() => setEyePhase('topbar'), 1500);
    return () => clearTimeout(timer);
  }, [deckViewingTs]);

  const handleDiceClick = useCallback(() => {
    const iconUrl = DICE_ICONS[Math.floor(Math.random() * DICE_ICONS.length)];
    wrappedUpdateState((s) => { const ns = clone(s); ns.dice_roll = { icon: iconUrl, timestamp: Date.now() }; return ns; });
  }, [wrappedUpdateState]);

  // Synced dice roll — both players see the same huge dice overlay.
  useEffect(() => {
    const dr = state.dice_roll;
    if (!dr?.timestamp) return;
    setDiceOverlay(dr.icon);
    const t = setTimeout(() => setDiceOverlay(null), 2000);
    return () => clearTimeout(t);
  }, [state.dice_roll?.timestamp]);

  const handleToggleTool = useCallback((tool) => {
    setToolToggles((prev) => ({ ...prev, [tool]: !prev[tool] }));
  }, []);

  const handleRandomClick = useCallback(() => {
    setRandomMode(true);
  }, []);

  const handleUpdateHotkey = useCallback((action, keys) => {
    setHotkeys((prev) => ({ ...prev, [action]: keys }));
  }, []);

  // Highlight a random card for 3 seconds (visible to both players via synced state)
  const randomHighlight = state.random_highlight;
  useEffect(() => {
    if (!randomHighlight?.card_id) {
      setHighlightCardId(null);
      return;
    }
    setHighlightCardId(randomHighlight.card_id);
    const timer = setTimeout(() => setHighlightCardId(null), 3000);
    return () => clearTimeout(timer);
  }, [randomHighlight?.timestamp]);

  const { resourceAnims, resourceFlash, emitResourceAnim } = useResourceAnimations();
  const { tokenAnims, emitTokenAnim, emitClearAnim } = useTokenAnimations();
  useRemoteAnimations({ game, emitResourceAnim, emitTokenAnim, localUpdateRef });
  useCardMovements({ game, myPlayerIndex, localUpdateRef, entries, ownAnimations });
  useBfMoveAnimations({ game, entries, supertypes });
  useBfAnimations({ game });
  const closeTokenPopup = useCallback(() => setTokenPopup(null), []);
  const { arrowDrag, arrowMousePos, arrowPaths, clearArrows, startArrowDrag, startBfArrowDrag, findArrowEl, arrowDragMovedRef } = useArrowDrag({ state: displayState, updateZones: wrappedUpdateZones, setSelection, setGroup, group, onDragEngaged: closeTokenPopup });

  const {
    selBox,
    toggleExhausted, toggleFlipped,
    handleAttach, handleDrop, handleCardClick,
    handleTokenChange, handleInfluenceChange, handleDetach, handleDuplicate,
    handleClearTokens, handleClearSupport, handleToggleAttachment, handleToggleStacking, handleToggleStructure,
    handleResolveTotal, drawCard, declareClash, declareReady, endClash, destroyBf, adjustAdvantage,
    adjustResource, computeSideTotal, stackDeck, shuffleDeck, viewDeck, myClashPicks,
    makeDragStart, makeTokenDragStart, makeDiscardDragStart, makeDeckDragStart,
    handleTokenCharge, handleGroupExhaust, handleGroupFlip, handleGroupTokenChange,
    handleGroupClearTokens, handleGroupClearSupport,
    handleAreaMouseDown, handleAreaMouseMove, handleAreaMouseUp, handleAreaMouseLeave,
    handleHoverEnter, handleHoverLeave,
    findCard, drawRandomToMoments, sendToGraveyard,
    makeCustomSectionDragStart, handleAddCustomSection, handleAddToCustomSection, handleRemoveCustomSection,
    handleDrawFromPool, handlePullFromPool,
  } = useCardInteractions({
    game, state: displayState, entries, supertypes, myPlayerIndex, players, battlefields,
    updateState: wrappedUpdateState, updateSharedState: wrappedUpdateState, updatePlayers: wrappedUpdatePlayers, updateGame: wrappedUpdateGame, updateCoordination: wrappedUpdateCoordination, updateZones: wrappedUpdateZones,
    emitTokenAnim, emitResourceAnim, emitClearAnim,
    selection, setSelection, group, setGroup,
    clearArrows, startArrowDrag, startBfArrowDrag,
    hotkeys,
  });

  const endRound = useCallback(() => {
    if (game.phase === 'income_reveal') { setSelection(null); return; }
    wrappedUpdateCoordination({
      players: (ps) => {
        const np = clone(ps);
        np[myPlayerIndex].end_round_pressed = true;
        np.forEach((p, i) => { if (i !== myPlayerIndex && p.is_ai) p.end_round_pressed = true; });
        return np;
      },
    });
  }, [game.phase, myPlayerIndex, wrappedUpdateCoordination, setSelection]);

  const selectIncome = useCallback((entryId) => {
    wrappedUpdateCoordination({
      players: (ps) => {
        const np = clone(ps);
        np[myPlayerIndex].income_selected = true;
        np[myPlayerIndex].income_entry_id = entryId;
        np.forEach((p, i) => {
          if (i !== myPlayerIndex && p.is_ai && !p.income_selected) {
            const opts = (state.income_options?.[i] || []);
            p.income_selected = true;
            p.income_entry_id = opts.length ? opts[Math.floor(Math.random() * opts.length)] : '';
          }
        });
        return np;
      },
    });
  }, [myPlayerIndex, state, wrappedUpdateCoordination]);

  const ackIncome = useCallback(() => {
    wrappedUpdateCoordination({
      players: (ps) => {
        const np = clone(ps);
        np[myPlayerIndex].income_ack = true;
        np.forEach((p, i) => { if (i !== myPlayerIndex && p.is_ai) p.income_ack = true; });
        return np;
      },
    });
  }, [myPlayerIndex, wrappedUpdateCoordination]);

  const confirmSplit = useCallback((pile0, pile1) => {
    wrappedUpdateCoordination({
      players: (ps) => {
        const np = clone(ps);
        np[myPlayerIndex].battlefield_split_done = true;
        np[myPlayerIndex].battlefield_piles = [pile0, pile1];
        np.forEach((p, i) => {
          if (i !== myPlayerIndex && p.is_ai && !p.battlefield_split_done) {
            const aiAll = [...(p.battlefield_piles?.[0] || [])];
            const aiP0 = []; const aiP1 = [];
            aiAll.forEach((id) => (Math.random() < 0.5 ? aiP0 : aiP1).push(id));
            np[i].battlefield_piles = [aiP0, aiP1];
            np[i].battlefield_split_done = true;
          }
        });
        return np;
      },
    });
  }, [myPlayerIndex, wrappedUpdateCoordination]);

  // Clicking a battlefield in the column only opens it in the sidebar. Focusing
  // (declaring a clash) is done exclusively via the sidebar Clash button.
  const onBfClick = useCallback((bfId) => {
    setSelection({ type: 'battlefield', battlefield_id: bfId });
  }, [setSelection]);

  const showTokenPopup = useCallback((cardId, x, y) => setTokenPopup({ cardId, x, y }), []);
  const wasArrowDrag = useCallback(() => arrowDragMovedRef.current, [arrowDragMovedRef]);

  // --- Phase transition effects ---
  // These watch the players array and fire phase transitions when both
  // players' flags are true, regardless of whether the flag was set locally
  // or arrived via a remote sync. This fixes the race where both players
  // click but neither sees the other's flag at click time.
  // Only the host (or the human when the opponent is AI) executes the
  // transition to prevent double round-increments.
  const shouldTransition = myPlayerIndex === 0 || players.every((p, i) => i === myPlayerIndex || p.is_ai);

  // AI behavior: playing cards on round transitions and responding to clashes.
  // Uses the raw updateState (not wrapped) so the human sees AI card movements
  // as animations rather than skipping them as "own" actions.
  useAILogic({ game, state, players, entries, shouldTransition, updateZones: wrappedUpdateZones });

  // main → income_select: both players pressed end round
  useEffect(() => {
    if (game.phase !== 'main') return;
    if (!players || players.length < 2) return;
    if (!players.every((p) => p.end_round_pressed)) return;
    if (!shouldTransition) return;
    wrappedUpdateCoordination({ phase: 'income_select' });
  }, [game.phase, players, shouldTransition, wrappedUpdateCoordination]);

  // income_select → income_reveal: both players selected income
  useEffect(() => {
    if (game.phase !== 'income_select') return;
    if (!players || players.length < 2) return;
    if (!players.every((p) => p.income_selected)) return;
    if (!shouldTransition) return;
    wrappedUpdateZones((s) => {
      const ns = { ...s, battlefields: clone(s.battlefields), rearguards: clone(s.rearguards), hands: clone(s.hands), side_cards: clone(s.side_cards), discards: clone(s.discards), new_zones: clone(s.new_zones) };
      if (rallyToggle) {
        for (const bf of ns.battlefields) {
          for (let pi = 0; pi < players.length; pi++) {
            const side = [...(bf.sides[pi] || [])];
            const remaining = [];
            for (const card of side) {
              const entry = entries[card.entry_id];
              const isStructure = card.is_structure ?? isStructureEntry(entry, supertypes);
              if (isStructure) remaining.push(card);
              else ns.rearguards[pi] = [...(ns.rearguards[pi] || []), card];
            }
            bf.sides[pi] = remaining;
          }
        }
        const unexhaust = (cards) => { (cards || []).forEach((c) => { c.exhausted = false; if (c.attachments) c.attachments.forEach((a) => a.exhausted = false); }); };
        for (let pi = 0; pi < players.length; pi++) {
          unexhaust(ns.hands[pi]);
          unexhaust(ns.rearguards[pi]);
          unexhaust(ns.side_cards?.[pi]);
          for (const bf of ns.battlefields) unexhaust(bf.sides[pi]);
        }
        // Rally also removes 1 Duration token from each of the player's cards;
        // any card whose last Duration counter is removed goes to the graveyard.
        for (let pi = 0; pi < players.length; pi++) {
          const decayDuration = (arr) => {
            if (!arr) return arr;
            const survivors = [];
            for (const card of arr) {
              if (card.tokens?.duration > 0) {
                card.tokens.duration -= 1;
                if (card.tokens.duration === 0) {
                  ns.discards[pi] = [...(ns.discards[pi] || []), card, ...(card.attachments || [])];
                  card.attachments = [];
                  continue;
                }
              }
              survivors.push(card);
            }
            return survivors;
          };
          ns.hands[pi] = decayDuration(ns.hands[pi]);
          ns.rearguards[pi] = decayDuration(ns.rearguards[pi]);
          if (ns.side_cards) ns.side_cards[pi] = decayDuration(ns.side_cards[pi]);
          if (ns.new_zones) ns.new_zones[pi] = decayDuration(ns.new_zones[pi]);
          for (const bf of ns.battlefields) {
            if (bf.sides[pi]) bf.sides[pi] = decayDuration(bf.sides[pi]);
          }
        }
      }
      ns.selected_income = players.map((p) => p?.income_entry_id || '');
      ns.revealed_income = players.map((p, i) => ({
        player_index: i,
        entry_id: p?.income_entry_id || '',
        entry_name: entries[p?.income_entry_id]?.name || '',
      }));
      return ns;
    }, ['battlefields', 'rearguards', 'hands', 'side_cards', 'discards', 'new_zones', 'selected_income', 'revealed_income']);
    wrappedUpdateCoordination({ phase: 'income_reveal' });
  }, [game.phase, players, shouldTransition, state, entries, supertypes, rallyToggle, wrappedUpdateZones, wrappedUpdateCoordination]);

  // income_reveal → main: both players must acknowledge, but each player's
  // ack is independent — one player acking only dismisses the reveal from
  // THEIR sidebar; the other player still sees it until they ack themselves.
  useEffect(() => {
    if (game.phase !== 'income_reveal') return;
    if (!players || players.length < 2) return;
    if (!players.every((p) => p.income_ack)) return;
    if (!shouldTransition) return;
    const NN = players.length;
    wrappedUpdateZones((s) => ({
      ...s,
      selected_income: Array.from({ length: NN }, () => ''),
      revealed_income: [],
    }), ['selected_income', 'revealed_income']);
    wrappedUpdateCoordination({
      state: (s) => ({ ...s, clash: { battlefield_id: '', participants: [], staging: false, selections: {}, ready: {} } }),
      players: (ps) => {
        const np = clone(ps);
        np.forEach((p) => { p.end_round_pressed = false; p.income_selected = false; p.income_ack = false; p.income_entry_id = ''; });
        return np;
      },
      phase: 'main',
      round: (game.round || 0) + 1,
    });
  }, [game.phase, players, shouldTransition, game.round, wrappedUpdateZones, wrappedUpdateCoordination]);

  // Deal the initial player-owned battlefields once both players have split
  // their battlefield deck. Each player has two areas; area 0 draws from
  // pile 0 (the selected cards), area 1 from pile 1 (the rest). Only the host
  // executes the deal so the shared state blob isn't written twice.
  useEffect(() => {
    if (game.status !== 'playing') return;
    if (!players || players.length < 2) return;
    if (state.bf_dealt) return;
    if (!players.every((p) => p.battlefield_split_done)) return;
    if (!shouldTransition) return;
    wrappedUpdateZones((s) => {
      const ns = { ...s, battlefields: clone(s.battlefields) };
      const NN = players.length;
      ns.battlefield_pools = Array.from({ length: NN }, () => [[], []]);
      for (let i = 0; i < NN; i++) {
        const oppsOf = players.map((_, j) => j).filter((j) => j !== i);
        const piles = players[i]?.battlefield_piles || [[], []];
        for (let pi = 0; pi < 2; pi++) {
          const pool = [...(piles[pi] || [])];
          const uid = `${Date.now()}_${i}_${pi}_${Math.random().toString(36).slice(2, 5)}`;
          const viewer = oppsOf[Math.min(pi, oppsOf.length - 1)];
          if (pool.length > 0) {
            const idx = Math.floor(Math.random() * pool.length);
            const entryId = pool.splice(idx, 1)[0];
            ns.battlefields.push({ id: `bf_${uid}`, owner: i, viewer, pool_index: pi, label: entries[entryId]?.name || 'Battlefield', type: 'card', card_entry_id: entryId, sides: Array.from({ length: NN }, () => []) });
          } else {
            ns.battlefields.push({ id: `bf_${uid}`, owner: i, viewer, pool_index: pi, label: 'Battlefield 12', type: 'number', number_value: 12, sides: Array.from({ length: NN }, () => []) });
          }
          ns.battlefield_pools[i][pi] = pool;
        }
      }
      ns.bf_dealt = true;
      return ns;
    }, ['battlefields', 'battlefield_pools', 'bf_dealt'], { immediate: true });
  }, [game.status, players, state, shouldTransition, entries, wrappedUpdateZones]);

  // Keep the sidebar focused on whichever battlefield is currently clashing,
  // for every player — not just whoever declared it. The declaring player's
  // selection is set directly in declareClash; this effect covers everyone
  // else, who only learns a clash started via sync.
  const prevClashKeyRef = useRef(null);
  useEffect(() => {
    const key = state.clash?.staging ? state.clash.battlefield_id : null;
    if (key && key !== prevClashKeyRef.current) {
      setSelection({ type: 'battlefield', battlefield_id: key });
    }
    prevClashKeyRef.current = key;
  }, [state.clash?.staging, state.clash?.battlefield_id, setSelection]);

  // Once a clash resolves (staging goes true → false while a battlefield is
  // still set), open that battlefield's sidebar for every player so both can
  // review the resolved board.
  const prevStagingRef = useRef(false);
  useEffect(() => {
    const wasStaging = prevStagingRef.current;
    const isStaging = !!state.clash?.staging;
    const bfId = state.clash?.battlefield_id;
    if (wasStaging && !isStaging && bfId) {
      setSelection({ type: 'battlefield', battlefield_id: bfId });
    }
    prevStagingRef.current = isStaging;
  }, [state.clash?.staging, state.clash?.battlefield_id, setSelection]);

  // Wide view is an independent toggle — it stays on or off regardless of
  // clash staging or focus state. The staging UI renders over the clashing
  // battlefield's zones inside the wide view itself.

  // Clash resolution: once every PARTICIPANT (not every player in the game —
  // a 3-player game can have a clash between only 2 of the 3) has readied up,
  // move their staged cards onto the battlefield and drop back to the
  // resolved (non-staging) view. Selections are written to state.clash only
  // once, at Ready time (see declareReady in useCardInteractions), so this
  // never reads a stale or missing selection.
  useEffect(() => {
    const clash = state.clash;
    if (!clash?.staging) return;
    if (!clash.participants?.length) return;
    if (!clash.participants.every((p) => clash.ready?.[p])) return;
    if (!shouldTransition) return;
    wrappedUpdateZones((s) => {
      const ns = {
        ...s,
        battlefields: clone(s.battlefields), hands: clone(s.hands), rearguards: clone(s.rearguards),
        discards: clone(s.discards), side_cards: clone(s.side_cards), banished: clone(s.banished),
        deleted: clone(s.deleted), new_zones: clone(s.new_zones),
      };
      const bf = ns.battlefields.find((b) => b.id === clash.battlefield_id);
      if (bf) {
        for (const pi of clash.participants) {
          const sel = clash.selections?.[pi] || [];
          for (const cardId of sel) {
            const card = removeCardById(ns, cardId);
            if (card) bf.sides[pi] = [...(bf.sides[pi] || []), card];
          }
        }
      }
      return ns;
    }, ['battlefields', 'hands', 'rearguards', 'discards', 'side_cards', 'banished', 'deleted', 'new_zones']);
    wrappedUpdateCoordination({ state: (s) => ({ ...s, clash: { battlefield_id: clash.battlefield_id, participants: [], staging: false, selections: {}, ready: {} } }) });
  }, [state, shouldTransition, wrappedUpdateZones, wrappedUpdateCoordination]);

  // Clash selection highlight — my own staged picks. While staging, this is
  // the local, not-yet-synced selection from useCardInteractions; once I've
  // readied up, it's read back from the synced state.clash.
  const myClashReady = !!state.clash?.ready?.[myPlayerIndex];
  const myClashSelection = myClashReady ? (state.clash?.selections?.[myPlayerIndex] || []) : myClashPicks;
  const clashSelectionValue = {
    active: !!state.clash?.staging && (state.clash.participants || []).includes(myPlayerIndex) && !myClashReady,
    selectedIds: new Set(myClashSelection),
    locked: myClashReady,
  };
  const readyMap = state.clash?.ready || {};

  return (
    <TokenAnimContext.Provider value={tokenAnims}>
    <AdjustInfluenceContext.Provider value={adjustInfluence}>
    <SmallTokensContext.Provider value={smallTokens}>
    <HighlightCardContext.Provider value={highlightCardId}>
    <ZoomHoverProvider enabled={zoomHover} instant={instantZoomHover} scale={zoomScale} setScale={setZoomScale} arrowDragging={!!arrowDrag} selectionBoxActive={!!selBox}>
    <TokenPopupContext.Provider value={{ show: showTokenPopup, wasDrag: wasArrowDrag }}>
    <MstTokenColorContext.Provider value={foghollowColor}>
    <ClashSelectionContext.Provider value={clashSelectionValue}>
    <div className="h-screen flex flex-col bg-background overflow-hidden play-game">
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          <GlobalToolsBar
            round={game.round}
            meEndRoundPressed={!!me?.end_round_pressed}
            adjustInfluence={adjustInfluence.clash || adjustInfluence.rearguard || adjustInfluence.hand}
            onToolsClick={() => setShowToolsDialog(true)}
            toolToggles={toolToggles}
            onIncomeClick={() => setShowIncomePopup(true)}
            onDiceClick={handleDiceClick}
            onRandomClick={handleRandomClick}
            onWideViewClick={() => setWideViewOn(v => !v)}
            wideViewOn={wideViewOn}
            onLeaveGame={() => navigate('/play')}
            {...(!isThreePlayer && opponentIndices.length === 1 ? {
              oppName: players[opponentIndices[0]]?.user_name,
              oppFlags: players[opponentIndices[0]]?.flags || 0,
              oppSupport: players[opponentIndices[0]]?.support || 0,
              oppEnergy: players[opponentIndices[0]]?.energy || 0,
              oppOther: players[opponentIndices[0]]?.other || 0,
              oppHandCount: (displayState.hands?.[opponentIndices[0]] || []).length,
              oppDiscardCount: (displayState.discards?.[opponentIndices[0]] || []).length,
              oppIndex: opponentIndices[0],
              onGraveyardClick: () => setSelection({ type: 'discard', playerIndex: opponentIndices[0] }),
              onDrop: handleDrop,
              resourceAnims,
              resourceFlash,
            } : {})}
          />
          {/* In 3p, opponents are split left/right; in 2p they stack vertically. */}
          <div className={`flex ${isThreePlayer ? 'flex-row' : 'flex-col'}`}>
            {opponentIndices.map((oi, oiPos) => (
              <div key={oi} className={`flex flex-col flex-1 min-w-0 ${isThreePlayer && oiPos > 0 ? 'border-l border-border/50' : ''}`}>
                {isThreePlayer && (
                  <OpponentInfoBar
                    oppName={players[oi]?.user_name}
                    oppFlags={players[oi]?.flags || 0}
                    oppSupport={players[oi]?.support || 0}
                    oppEnergy={players[oi]?.energy || 0}
                    oppOther={players[oi]?.other || 0}
                    oppHandCount={(displayState.hands?.[oi] || []).length}
                    oppDiscardCount={(displayState.discards?.[oi] || []).length}
                    oppIndex={oi}
                    onGraveyardClick={() => setSelection({ type: 'discard', playerIndex: oi })}
                    onDrop={handleDrop}
                    resourceAnims={resourceAnims} resourceFlash={resourceFlash}
                  />
                )}
                <RearguardSection cards={displayState.rearguards?.[oi] || []} sideCards={displayState.side_cards?.[oi] || []} newZoneEnabled={state.new_zone_enabled?.[oi] || false} newZoneCards={displayState.new_zones?.[oi] || []} entries={entries} supertypes={supertypes} playerIndex={oi} borderClass="border-b border-border/50" selectedCardId={selectedCardId} groupIds={groupIds} onDrop={handleDrop} makeDragStart={makeDragStart} onSelect={handleCardClick} onCardDrop={handleAttach} onHoverEnter={handleHoverEnter} onHoverLeave={handleHoverLeave} onDoubleClick={toggleExhausted} onAreaMouseDown={handleAreaMouseDown} onAreaMouseMove={handleAreaMouseMove} onAreaMouseUp={handleAreaMouseUp} onAreaMouseLeave={handleAreaMouseLeave} compact={isThreePlayer} hideMomentsWhenEmpty={isThreePlayer} />
              </div>
            ))}
          </div>
          <div className="flex-1 flex min-h-0">
            {wideViewOn ? (
              <WideView battlefields={battlefields} focusedBfId={activeBfId} entries={entries} supertypes={supertypes} myPlayerIndex={myPlayerIndex} opponentIndices={opponentIndices} playerNames={players.map((p) => p?.user_name || '?')} onBfClick={onBfClick} onDrop={handleDrop} makeDragStart={makeDragStart} onSelect={handleCardClick} onCardDrop={handleAttach} onHoverEnter={handleHoverEnter} onHoverLeave={handleHoverLeave} onDoubleClick={toggleExhausted} selectedCardId={selectedCardId} groupIds={groupIds} onAreaMouseDown={handleAreaMouseDown} onAreaMouseMove={handleAreaMouseMove} onAreaMouseUp={handleAreaMouseUp} onAreaMouseLeave={handleAreaMouseLeave} clashBfId={state.clash?.battlefield_id} clashStaging={!!state.clash?.staging} participants={state.clash?.participants || []} myReady={myClashReady} readyMap={readyMap} mySelectionCount={myClashSelection.length} onDeclareReady={declareReady} computeSideTotal={computeSideTotal} />
            ) : (
              <>
                <BattlefieldColumn battlefields={battlefields} entries={entries} supertypes={supertypes} myPlayerIndex={myPlayerIndex} activeBfId={activeBfId} onBfClick={onBfClick} onDrop={handleDrop} onAreaMouseDown={handleAreaMouseDown} onAreaMouseMove={handleAreaMouseMove} onAreaMouseUp={handleAreaMouseUp} onAreaMouseLeave={handleAreaMouseLeave} />
                <ClashSides activeBf={activeBf} participants={participantIndices} myPlayerIndex={myPlayerIndex} playerNames={players.map((p) => p?.user_name || '?')} selectedCardId={selectedCardId} groupIds={groupIds} entries={entries} supertypes={supertypes} onDrop={handleDrop} makeDragStart={makeDragStart} onSelect={handleCardClick} onCardDrop={handleAttach} onHoverEnter={handleHoverEnter} onHoverLeave={handleHoverLeave} computeSideTotal={computeSideTotal} onDoubleClick={toggleExhausted} onAreaMouseDown={handleAreaMouseDown} onAreaMouseMove={handleAreaMouseMove} onAreaMouseUp={handleAreaMouseUp} onAreaMouseLeave={handleAreaMouseLeave} clashInProgress={!!state.clash?.staging} myReady={myClashReady} readyMap={readyMap} mySelectionCount={myClashSelection.length} onDeclareReady={declareReady} />
              </>
            )}
          </div>
          <RearguardSection cards={myRearguard} sideCards={displayState.side_cards?.[myPlayerIndex] || []} newZoneEnabled={state.new_zone_enabled?.[myPlayerIndex] || false} newZoneCards={displayState.new_zones?.[myPlayerIndex] || []} entries={entries} supertypes={supertypes} playerIndex={myPlayerIndex} borderClass="border-t border-border/50" selectedCardId={selectedCardId} groupIds={groupIds} onDrop={handleDrop} makeDragStart={makeDragStart} onSelect={handleCardClick} onCardDrop={handleAttach} onHoverEnter={handleHoverEnter} onHoverLeave={handleHoverLeave} onDoubleClick={toggleExhausted} onAreaMouseDown={handleAreaMouseDown} onAreaMouseMove={handleAreaMouseMove} onAreaMouseUp={handleAreaMouseUp} onAreaMouseLeave={handleAreaMouseLeave} />
        </div>

        {/* Sidebar */}
        <div className="w-1/3 min-w-[280px] max-w-[480px] border-l border-border overflow-hidden bg-card/30 flex-shrink-0">
          <GameSidebar
            selection={selection} game={game} state={displayState} entries={entries} supertypes={supertypes} myPlayerIndex={myPlayerIndex}
            onClose={() => setSelection(null)} onTokenChange={handleTokenChange} onDetach={handleDetach} onCardClick={handleCardClick}
            onDeclareClash={declareClash} onResolveTotal={handleResolveTotal}
            onDrop={handleDrop} makeDragStart={makeDragStart} onTokenDragStart={makeTokenDragStart} onDiscardDragStart={makeDiscardDragStart}
            onCardDrop={handleAttach} onAckIncome={ackIncome} computeSideTotal={computeSideTotal} findCard={findCard}
            onToggleExhausted={toggleExhausted} onToggleFlipped={toggleFlipped} onHoverEnter={handleHoverEnter} onHoverLeave={handleHoverLeave}
            onEndClash={endClash} onAdvantageChange={adjustAdvantage} onDestroyBf={destroyBf} onChargeChange={handleTokenChange} onTokenChargeChange={handleTokenCharge} onGroupExhaust={handleGroupExhaust} onGroupFlip={handleGroupFlip} onGroupTokenChange={handleGroupTokenChange} onGroupClearTokens={handleGroupClearTokens} onGroupClearSupport={handleGroupClearSupport} onDuplicate={handleDuplicate} onClearTokens={handleClearTokens} onClearSupport={handleClearSupport} onSendToGraveyard={sendToGraveyard} onInfluenceChange={handleInfluenceChange} onToggleAttachment={handleToggleAttachment} onToggleStacking={handleToggleStacking} onToggleStructure={handleToggleStructure} onStackDeck={stackDeck} onViewDeck={viewDeck} onShuffleDeck={shuffleDeck} folderEntries={folderEntries} onDrawRandom={drawRandomToMoments} customSections={displayState.custom_sections?.[myPlayerIndex] || []} onAddCustomSection={handleAddCustomSection} onAddToCustomSection={handleAddToCustomSection} onCustomSectionDragStart={makeCustomSectionDragStart} onRemoveCustomSection={handleRemoveCustomSection} onDrawFromPool={handleDrawFromPool} onPullFromPool={handlePullFromPool}
            selectedCardId={selectedCardId} groupIds={groupIds} oppName={players[opponentIndices[0]]?.user_name} myName={me?.user_name} wideViewOn={wideViewOn}
          />
        </div>
      </div>

      <PlayerZone
        game={game} state={displayState} entries={entries} supertypes={supertypes} myPlayerIndex={myPlayerIndex}
        onDrop={handleDrop} onDraw={drawCard} onTokenDragStart={makeTokenDragStart} onDiscardDragStart={makeDiscardDragStart}
        onCardDragStart={makeDragStart} onCardClick={handleCardClick} onCardDrop={handleAttach}
        onResourceClick={adjustResource} onEndRound={endRound} onToggleExhausted={toggleExhausted} resourceAnims={resourceAnims.filter((a) => a.playerIndex === myPlayerIndex)} resourceFlash={resourceFlash} onDeckDragStart={makeDeckDragStart}
        onSelectTokens={() => setSelection({ type: 'tokens' })} onSelectDiscard={() => setSelection({ type: 'discard' })}
        onDeckRightClick={() => setSelection({ type: 'deck', playerIndex: myPlayerIndex })}
        selection={selection} onHoverEnter={handleHoverEnter} onHoverLeave={handleHoverLeave}
        onAreaMouseDown={handleAreaMouseDown} onAreaMouseMove={handleAreaMouseMove} onAreaMouseUp={handleAreaMouseUp} onAreaMouseLeave={handleAreaMouseLeave}
      />

      {game.status === 'playing' && !me?.battlefield_split_done && Object.keys(entries).length > 0 && (
        <BattlefieldSplitDialog
          battlefieldIds={(players[myPlayerIndex]?.battlefield_piles || []).flat()}
          entries={entries}
          supertypes={supertypes}
          onConfirm={confirmSplit}
          pileLabels={pileLabels}
        />
      )}

      {game.phase === 'income_select' && !me?.income_selected && (
        <IncomeSelectDialog
          players={players}
          state={state}
          entries={entries}
          supertypes={supertypes}
          myPlayerIndex={myPlayerIndex}
          rallyToggle={rallyToggle}
          onToggleRally={() => setRallyToggle(v => !v)}
          onSelectIncome={selectIncome}
        />
      )}

      {eyePhase !== 'hidden' && (
        <div
          className="fixed pointer-events-none z-50 transition-all duration-700 ease-in-out"
          style={eyePhase === 'center' ? {
            right: '50%', top: '50%',
            transform: 'translate(50%, -50%)',
            width: 'min(60vw, 60vh)', height: 'min(60vw, 60vh)',
            opacity: 0.7,
          } : {
            left: '50%', top: '6px',
            transform: 'translateX(-50%)',
            width: '28px', height: '28px',
            opacity: 0.7,
          }}
        >
          <img src={BLEEDING_EYE_URL} className="w-full h-full object-contain" alt="" />
        </div>
      )}

      {diceOverlay && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <img src={diceOverlay} style={{ width: 'min(50vw, 50vh)', height: 'min(50vw, 50vh)', objectFit: 'contain' }} alt="" />
        </div>
      )}

      {showToolsDialog && (
        <ToolsDialog
          toolToggles={toolToggles}
          onToggleTool={handleToggleTool}
          adjustInfluence={adjustInfluence}
          onToggleAdjustInfluence={(key) => setAdjustInfluence(prev => ({ ...prev, [key]: !prev[key] }))}
          smallTokens={smallTokens}
          onToggleSmallTokens={() => setSmallTokens(v => !v)}
          zoomHover={zoomHover}
          onToggleZoomHover={() => setZoomHover(v => !v)}
          instantZoomHover={instantZoomHover}
          onToggleInstantZoomHover={() => setInstantZoomHover(v => !v)}
          ownAnimations={ownAnimations}
          onToggleOwnAnimations={() => setOwnAnimations(v => !v)}
          newZone={state.new_zone_enabled?.[myPlayerIndex] || false}
          onToggleNewZone={toggleNewZone}
          hotkeys={hotkeys}
          onUpdateHotkey={handleUpdateHotkey}
          onResetHotkeys={() => setHotkeys(DEFAULT_HOTKEYS)}
          onClose={() => setShowToolsDialog(false)}
        />
      )}

      {showIncomePopup && (
        <IncomeOptionsDialog
          incomeOptions={state.income_options}
          entries={entries}
          supertypes={supertypes}
          playerNames={players.map((p) => p?.user_name)}
          myPlayerIndex={myPlayerIndex}
          onClose={() => setShowIncomePopup(false)}
        />
      )}

      {randomMode && (
        <div
          className="fixed inset-0 z-40 cursor-crosshair bg-primary/5 flex items-start justify-center pt-20"
          onClick={(e) => {
            e.currentTarget.style.pointerEvents = 'none';
            const el = document.elementFromPoint(e.clientX, e.clientY);
            e.currentTarget.style.pointerEvents = 'auto';
            const sectionEl = el?.closest('[data-section]');
            if (!sectionEl) { setRandomMode(false); return; }
            const parts = sectionEl.dataset.section.split(':');
            const zone = parts[0];
            const playerIndex = parseInt(parts[1]);
            const battlefieldId = parts[2];
            let cards = [];
            if (zone === 'rearguard') cards = displayState.rearguards?.[playerIndex] || [];
            else if (zone === 'side_cards') cards = displayState.side_cards?.[playerIndex] || [];
            else if (zone === 'hand') cards = displayState.hands?.[playerIndex] || [];
            else if (zone === 'discard') cards = displayState.discards?.[playerIndex] || [];
            else if (zone === 'battlefield') {
              const bf = displayState.battlefields?.find((b) => b.id === battlefieldId);
              if (bf) cards = bf.sides?.[playerIndex] || [];
            }
            const nonAttached = cards.filter((c) => !c.is_attachment);
            if (nonAttached.length === 0) { setRandomMode(false); return; }
            const randomCard = nonAttached[Math.floor(Math.random() * nonAttached.length)];
            wrappedUpdateState((s) => {
              const ns = clone(s);
              ns.random_highlight = { card_id: randomCard.id, timestamp: Date.now() };
              return ns;
            });
            setRandomMode(false);
          }}
        >
          <div className="bg-card border border-border rounded-lg px-4 py-2 text-sm text-foreground pointer-events-none">Click an area to select a random card</div>
        </div>
      )}

      {/* Arrow overlay */}
      <svg className="fixed inset-0 pointer-events-none z-30" style={{ width: '100vw', height: '100vh' }}>
        <defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#fbbf24" /></marker></defs>
        {arrowPaths.map((p) => <path key={p.id} d={p.d} stroke="#fbbf24" strokeWidth="2" fill="none" markerEnd="url(#arrowhead)" />)}
        {arrowDrag && arrowDrag.fromIds?.map((fromId, i) => {
          const fromEl = findArrowEl(fromId);
          if (!fromEl) return null;
          const fr = fromEl.getBoundingClientRect();
          const x1 = fr.left + fr.width / 2, y1 = fr.top + fr.height / 2;
          const x2 = arrowMousePos?.x || x1, y2 = arrowMousePos?.y || y1;
          const mx = (x1 + x2) / 2 + (y2 - y1) * 0.3, my = (y1 + y2) / 2 - (x2 - x1) * 0.3;
          return <path key={i} d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`} stroke="#fbbf24" strokeWidth="2" fill="none" strokeDasharray="4 2" />;
        })}
      </svg>

      {tokenPopup && (() => {
        const popupCard = findCard(tokenPopup.cardId)?.card;
        return <TokenPopup card={popupCard} x={tokenPopup.x} y={tokenPopup.y} mstColor={foghollowColor} onTokenChange={handleTokenChange} onClearTokens={handleClearTokens} onClearSupport={handleClearSupport} onSendToGraveyard={sendToGraveyard} onClose={() => setTokenPopup(null)} />;
      })()}

      {/* Selection box overlay */}
      {selBox && (
        <div className="fixed border-2 border-primary bg-primary/10 pointer-events-none z-30" style={{
          left: selBox.areaLeft + Math.min(selBox.startX, selBox.x),
          top: selBox.areaTop + Math.min(selBox.startY, selBox.y),
          width: Math.abs(selBox.x - selBox.startX),
          height: Math.abs(selBox.y - selBox.startY),
        }} />
      )}
    </div>
    </ClashSelectionContext.Provider>
    </MstTokenColorContext.Provider>
    </TokenPopupContext.Provider>
    </ZoomHoverProvider>
    </HighlightCardContext.Provider>
    </SmallTokensContext.Provider>
    </AdjustInfluenceContext.Provider>
    </TokenAnimContext.Provider>
  );
}