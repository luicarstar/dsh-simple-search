window.__ModuleLoader__.load({
	id: "dsh-simple-search",
	factory: function (require) {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const react = require("react");
		const { useState, useEffect, useRef, useCallback, createElement } = react;

		//#region dictionaries
		const zh = {
			button: "内容搜索",
			placeholder: "搜索全部会话内容…",
			searching: "搜索中…",
			empty: "没有匹配内容",
			error: "搜索失败",
			hint: "输入关键词搜索全部会话内容 · Enter 打开 · Esc 关闭",
			more: "仅显示前 30 条，缩小关键词试试"
		};
		const en = {
			button: "Search content",
			placeholder: "Search every session content…",
			searching: "Searching…",
			empty: "No matches",
			error: "Search failed",
			hint: "Search all session content · Enter opens · Esc closes",
			more: "Showing the first 30 matches; narrow the query"
		};
		//#endregion

		//#region styles
		const CSS_TEXT = [
			".ss-btn { border: none; background: transparent; color: var(--dsw-alias-label-secondary, #9aa0aa); width: 28px; height: 28px; border-radius: var(--dsw-radius-sm, 6px); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; font-size: 14px; line-height: 1; }",
			".ss-btn:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,.08)); color: var(--dsw-alias-label-primary, #fff); }",
			".ss-overlay { position: fixed; inset: 0; z-index: 60; background: rgba(0,0,0,.45); display: flex; align-items: flex-start; justify-content: center; padding-top: 12vh; }",
			".ss-panel { width: min(660px, 92vw); background: var(--dsw-alias-bg-base, #17191d); border: 1px solid rgba(255,255,255,.12); border-radius: 12px; box-shadow: 0 24px 64px rgba(0,0,0,.55); overflow: hidden; }",
			".ss-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,.08); }",
			".ss-icon { opacity: .55; font-size: 13px; }",
			".ss-input { flex: 1; min-width: 0; background: transparent; border: none; outline: none; color: var(--dsw-alias-label-primary, #e8eaed); font-size: 15px; padding: 4px 0; }",
			".ss-body { max-height: 52vh; overflow: auto; padding: 6px; }",
			".ss-hint { padding: 18px 12px; text-align: center; font-size: 13px; color: var(--dsw-alias-label-tertiary, #6b7280); }",
			".ss-hint.ss-error { color: var(--dsw-alias-state-error-primary, #ff7b72); }",
			".ss-item { padding: 8px 10px; border-radius: 8px; cursor: pointer; }",
			".ss-item-active { background: rgba(255,255,255,.07); }",
			".ss-snippet { font-size: 13px; line-height: 1.55; color: var(--dsw-alias-label-secondary, #cfd3da); word-break: break-word; }",
			".ss-meta { margin-top: 3px; font-size: 11px; color: var(--dsw-alias-label-tertiary, #7d828c); }",
			".ss-mark { background: #ffeb3b; color: #10131a; border-radius: 2px; padding: 0 1px; }",
			".ss-flash { animation: ss-flash-kf 2.6s ease-out; }",
			"@keyframes ss-flash-kf { 0% { background: rgba(59,109,255,.45); box-shadow: 0 0 0 4px rgba(59,109,255,.25); } 100% { background: transparent; box-shadow: none; } }"
		].join(" ");
		//#endregion

		//#region text helpers
		function asText(value) {
			return value === null || value === undefined ? "" : String(value);
		}

		function tokenList(query) {
			const parts = asText(query).split(" ");
			const out = [];
			for (let index = 0; index < parts.length; index += 1) {
				const part = parts[index].trim();
				if (part.length > 0 && out.indexOf(part) === -1) out.push(part);
			}
			return out;
		}

		function shortId(sessionId) {
			const value = asText(sessionId);
			return value.length > 12 ? value.slice(0, 12) : value;
		}

		function highlighted(text, query) {
			const source = asText(text);
			const tokens = tokenList(query);
			if (tokens.length === 0 || source.length === 0) return [source];
			const lowerSource = source.toLowerCase();
			const lowerTokens = tokens.map(function (token) { return token.toLowerCase(); });
			const out = [];
			let cursor = 0;
			let key = 0;
			while (cursor < source.length) {
				let hitIndex = -1;
				let hitLength = 0;
				for (let index = 0; index < lowerTokens.length; index += 1) {
					const found = lowerSource.indexOf(lowerTokens[index], cursor);
					if (found === -1) continue;
					if (hitIndex === -1 || found < hitIndex) {
						hitIndex = found;
						hitLength = lowerTokens[index].length;
					}
				}
				if (hitIndex === -1) {
					out.push(source.slice(cursor));
					break;
				}
				if (hitIndex > cursor) out.push(source.slice(cursor, hitIndex));
				out.push(createElement("mark", { key: "mark-" + key, className: "ss-mark" }, source.slice(hitIndex, hitIndex + hitLength)));
				key += 1;
				cursor = hitIndex + hitLength;
			}
			return out;
		}
		//#endregion

		//#region reveal
		/**
		* The conversation flow element. rc.5 marks it with data-chat-flow and every
		* rendered turn with data-chat-turn; scoping to it keeps a sidebar or title hit
		* from stealing the jump.
		*/
		function conversationRoot() {
			return document.querySelector("[data-chat-flow]") || document.querySelector("[data-chat-turn]") || null;
		}

		function visibleElement(element) {
			if (element === null || element === undefined) return false;
			if (typeof element.getClientRects !== "function") return true;
			return element.getClientRects().length > 0;
		}

		function scrollParentOf(node) {
			let current = node;
			while (current !== null && current !== document.body) {
				const style = window.getComputedStyle(current);
				const overflow = style === null || style === undefined ? "" : String(style.overflowY || "");
				if ((overflow === "auto" || overflow === "scroll" || overflow === "overlay") && current.scrollHeight > current.clientHeight) {
					return current;
				}
				current = current.parentElement;
			}
			return null;
		}

		function findMatchNode(candidates, root) {
			const scope = root === null || root === undefined ? document.body : root;
			const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
				acceptNode: function (candidate) {
					const parent = candidate.parentElement;
					if (parent === null) return NodeFilter.FILTER_REJECT;
					if (!visibleElement(parent)) return NodeFilter.FILTER_REJECT;
					const value = candidate.nodeValue || "";
					for (let index = 0; index < candidates.length; index += 1) {
						if (value.indexOf(candidates[index]) !== -1) return NodeFilter.FILTER_ACCEPT;
					}
					return NodeFilter.FILTER_REJECT;
				}
			});
			return walker.nextNode();
		}

		/**
		* Scroll the opened Session to the matched text and flash it once.
		* Older turns are not in the DOM until the paging reader loads them, so a miss
		* nudges the flow viewport to its start, retries, and restores the original
		* scroll position when it finally gives up.
		*/
		function revealInConversation(snippet, query) {
			const fragments = asText(snippet).split("…").map(function (part) { return part.trim(); }).filter(function (part) { return part.length >= 6; });
			const tokens = tokenList(query).filter(function (part) { return part.length >= 2; });
			const candidates = [];
			for (let index = 0; index < fragments.length; index += 1) candidates.push(fragments[index]);
			for (let index = 0; index < tokens.length; index += 1) candidates.push(tokens[index]);
			if (candidates.length === 0) return;

			const delays = [600, 1300, 2200, 3400];
			let attempt = 0;
			let restored = false;
			let originalTop;

			const tryReveal = function () {
				const root = conversationRoot();
				let node = null;
				try {
					node = findMatchNode(candidates, root);
				} catch (error) {
					node = null;
				}
				if (node === null) {
					attempt += 1;
					if (attempt < delays.length) {
						try {
							const scroller = scrollParentOf(root === null ? document.body : root);
							if (scroller !== null) {
								if (originalTop === undefined) originalTop = scroller.scrollTop;
								scroller.scrollTop = 0;
								scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
							}
						} catch (error) {
							// not scrollable: keep retrying the DOM as it is
						}
						window.setTimeout(tryReveal, delays[attempt] - delays[attempt - 1]);
						return;
					}
					if (!restored && originalTop !== undefined) {
						restored = true;
						try {
							const scroller = scrollParentOf(root === null ? document.body : root);
							if (scroller !== null) scroller.scrollTop = originalTop;
						} catch (error) {
							// nothing to restore
						}
					}
					return;
				}
				const element = node.parentElement;
				if (element === null) return;
				element.scrollIntoView({ behavior: "smooth", block: "center" });
				element.classList.add("ss-flash");
				window.setTimeout(function () { element.classList.remove("ss-flash"); }, 2800);
			};

			window.setTimeout(tryReveal, delays[0]);
		}
		//#endregion

		//#region components
		function SimpleSearchButton(props) {
			const [open, setOpen] = useState(false);
			const t = typeof props.t === "function" ? props.t : function (key) { return key; };
			return createElement(react.Fragment, null,
				createElement("button", {
					type: "button",
					className: "ss-btn",
					title: t("button"),
					"aria-label": t("button"),
					onClick: function () { setOpen(true); }
				}, "🔍"),
				open ? createElement(SearchPanel, {
					t: t,
					searchSessions: props.searchSessions,
					openSession: props.openSession,
					onClose: function () { setOpen(false); }
				}) : null);
		}

		function SearchPanel(props) {
			const t = typeof props.t === "function" ? props.t : function (key) { return key; };
			const [query, setQuery] = useState("");
			const [status, setStatus] = useState("idle");
			const [items, setItems] = useState([]);
			const [active, setActive] = useState(0);
			const inputRef = useRef(null);
			const abortRef = useRef(null);

			useEffect(function () {
				const timer = window.setTimeout(function () {
					if (inputRef.current !== null) inputRef.current.focus();
				}, 30);
				return function () { window.clearTimeout(timer); };
			}, []);

			useEffect(function () {
				return function () {
					if (abortRef.current !== null) abortRef.current.abort();
				};
			}, []);

			const run = useCallback(async function (text) {
				if (abortRef.current !== null) abortRef.current.abort();
				const value = text.trim();
				if (value === "") {
					setItems([]);
					setStatus("idle");
					setActive(0);
					return;
				}
				const controller = new AbortController();
				abortRef.current = controller;
				setStatus("pending");
				try {
					const result = await props.searchSessions(value, controller.signal);
					if (controller.signal.aborted) return;
					const rows = result !== null && result !== undefined && result.items !== undefined ? result.items : [];
					const limited = rows.slice(0, 30);
					setItems(limited);
					setActive(0);
					setStatus(limited.length === 0 ? "empty" : "done");
				} catch (error) {
					if (controller.signal.aborted) return;
					setItems([]);
					setStatus("error");
				}
			}, [props]);

			useEffect(function () {
				const timer = window.setTimeout(function () { run(query); }, 280);
				return function () { window.clearTimeout(timer); };
			}, [query, run]);

			const open = function (item) {
				if (item === undefined || item === null) return;
				props.openSession(item.sessionId);
				props.onClose();
				revealInConversation(item.snippet, query);
			};

			const onKeyDown = function (event) {
				if (event.key === "Escape") {
					event.preventDefault();
					props.onClose();
					return;
				}
				if (event.key === "ArrowDown") {
					event.preventDefault();
					setActive(function (value) { return Math.min(value + 1, Math.max(items.length - 1, 0)); });
					return;
				}
				if (event.key === "ArrowUp") {
					event.preventDefault();
					setActive(function (value) { return Math.max(value - 1, 0); });
					return;
				}
				if (event.key === "Enter") {
					event.preventDefault();
					open(items[active]);
				}
			};

			const rows = items.map(function (item, index) {
				return createElement("div", {
					key: asText(item.sessionId) + "-" + index,
					className: index === active ? "ss-item ss-item-active" : "ss-item",
					onMouseEnter: function () { setActive(index); },
					onMouseDown: function (event) { event.preventDefault(); open(item); }
				},
					createElement("div", { className: "ss-snippet" }, highlighted(item.snippet, query)),
					createElement("div", { className: "ss-meta" }, shortId(item.sessionId)));
			});

			const bodyText = status === "idle" ? t("hint")
				: status === "pending" ? t("searching")
				: status === "empty" ? t("empty")
				: status === "error" ? t("error")
				: null;

			return createElement("div", {
				className: "ss-overlay",
				onMouseDown: function (event) {
					if (event.target === event.currentTarget) props.onClose();
				}
			},
				createElement("div", { className: "ss-panel", role: "dialog", "aria-label": t("button") },
					createElement("div", { className: "ss-head" },
						createElement("span", { className: "ss-icon" }, "🔍"),
						createElement("input", {
							ref: inputRef,
							className: "ss-input",
							type: "text",
							value: query,
							placeholder: t("placeholder"),
							onChange: function (event) { setQuery(event.target.value); },
							onKeyDown: onKeyDown
						})),
					createElement("div", { className: "ss-body" },
						bodyText === null ? rows : createElement("div", { className: status === "error" ? "ss-hint ss-error" : "ss-hint" }, bodyText),
						status === "done" && items.length >= 30 ? createElement("div", { className: "ss-hint" }, t("more")) : null)));
		}
		//#endregion

		//#region plugin body
		const inject = ["slots", "locale", "sessions", "uiWorkspace"];

		function apply(ctx) {
			ctx.effect(function () { return ctx.locale.register("simple-search", { zh: zh, en: en }); }, "simple-search: dictionaries");

			let bound;
			try {
				bound = typeof ctx.locale.bind === "function" ? ctx.locale.bind("simple-search") : undefined;
			} catch (error) {
				bound = undefined;
			}
			if (bound === undefined) bound = function (key) { return key; };

			const searchSessions = async function (query, signal) {
				const result = await ctx.sessions.search(query, signal);
				if (result === null || result === undefined || result.ok !== true) {
					const message = result !== null && result !== undefined && result.error !== undefined && result.error !== null && result.error.message !== undefined
						? result.error.message
						: "session search failed";
					throw new Error(message);
				}
				return result.value;
			};

			const openSession = function (sessionId) {
				ctx.uiWorkspace.openSession(sessionId);
			};

			const style = document.createElement("style");
			style.textContent = CSS_TEXT;
			document.head.appendChild(style);
			ctx.effect(function () { return function () { style.remove(); }; }, "simple-search: styles");

			ctx.slots.inject("conversation.session.header.actions", function () {
				return ctx.slots.register({
					name: "conversation.session.header.actions",
					id: "simple-search",
					order: 16,
					locale: "simple-search",
					inject: function () {
						return { t: bound, searchSessions: searchSessions, openSession: openSession };
					}
				}, SimpleSearchButton);
			});
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
