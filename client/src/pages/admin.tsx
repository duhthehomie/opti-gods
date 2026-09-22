                      ? <Link className="w-3.5 h-3.5 text-amber-400" />
                          : <Activity className="w-3.5 h-3.5 text-sky-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white font-medium truncate">{item.label}</p>
                      <p className="text-[10px] text-zinc-600 font-mono truncate">{item.detail}</p>
                      {(item.city || item.country) && (
                        <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                          {countryFlag(item.country)}{countryFlag(item.country) ? " " : ""}
                          {[item.city, item.region, item.country].filter(Boolean).join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn(
                        "text-[10px] font-bold",
                         item.type === "code" ? "text-red-400" : item.type === "friend" ? "text-amber-400" : "text-sky-400"
                      )}>
                         {item.type === "code" ? `+$${PRICE_PER_CODE}` : item.type === "friend" ? "Free" : item.type === "device-link" ? "Linked" : "Device"}
                      </p>
                      <p className="text-[10px] text-zinc-600">{timeAgo(item.at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            );
            })()}

            {activityItems.length > 0 && (
              <div className="p-4 bg-zinc-900/40 border border-white/5 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">
                    Total estimated revenue: <span className="text-emerald-400">${stats?.revenueEstimate ?? 0}</span>
                  </p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">
                    {stats?.usedCodes ?? 0} paid codes × ${PRICE_PER_CODE} · {stats?.usedFriends ?? 0} free friends
                  </p>
                </div>
                <Flame className="w-6 h-6 text-red-500 opacity-60" />
              </div>
            )}
          </div>
        )}

        {/* ─── EMAIL REQUESTS TAB ───────────────────────────────────── */}
        {tab === "email" && (
          <div className="space-y-4">
            {/* Email config status */}
            {emailConfiguredQuery.data && !emailConfiguredQuery.data.configured && (
              <div className="flex items-start gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-300">Email not configured</p>
                  <p className="text-[11px] text-amber-600 mt-1 leading-relaxed">
                    Set <span className="font-mono text-amber-400">EMAIL_USER</span> (your Gmail address) and{" "}
                    <span className="font-mono text-amber-400">EMAIL_PASS</span> (Gmail App Password) in environment secrets to enable auto-sending.
                    Until then you can still see requests here and send codes manually via Discord.
                  </p>
                </div>
              </div>
            )}

            {emailConfiguredQuery.data?.configured && (
              <div className="flex items-center gap-2 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <p className="text-[11px] text-emerald-400 font-bold">Email configured — codes will be auto-sent when you click "Send Code"</p>
              </div>
            )}

            <div className="text-[10px] text-zinc-600 leading-relaxed">
              Customers submit their email + payment proof here. Review each request and click{" "}
              <strong className="text-zinc-400">Send Code</strong> to automatically pick an available code and email it to them.
              You do not need to be online — click when you check in.
            </div>

            {emailRequestsQuery.isLoading ? (
              <div className="p-12 text-center text-xs text-zinc-600 animate-pulse">Loading email requests...</div>
            ) : !emailRequestsQuery.data?.length ? (
              <div className="p-12 text-center">
                <Inbox className="w-8 h-8 text-zinc-800 mx-auto mb-3" />
                <p className="text-xs text-zinc-600">No email requests yet.</p>
                <p className="text-[10px] text-zinc-700 mt-1">Customers use the "Get Code via Email" button on the site.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-white/5 overflow-hidden divide-y divide-white/5">
                {emailRequestsQuery.data
                  .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
                  .map(req => {
                    // Cross-reference sentCodeId with the codes list to detect customer redemption
                    const sentCode = req.sentCodeId
                      ? (codesQuery.data || []).find(c => c.id === req.sentCodeId)
                      : null;
                    const customerRedeemed = !!(sentCode?.usedAt);
                    // Per-customer deploy stats — matched by code value
                    const deployStat = sentCode?.code
                      ? (customerDeployStatsQuery.data || []).find(s => s.codeRef === sentCode.code)
                      : null;
                    const isSentStatus = req.status === "sent" || req.status === "auto-sent";

                    return (
                    <div
                      key={req.id}
                      data-testid={`row-email-req-${req.id}`}
                      className={cn(
                        "px-3 py-3 transition-colors",
                        req.status === "pending" ? "hover:bg-zinc-900/40" : "opacity-60 hover:opacity-80"
                      )}
                    >
                      {/* Row 1: icon + email + status badge */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className={cn(
                          "w-6 h-6 rounded-lg flex items-center justify-center shrink-0",
                          isSentStatus && customerRedeemed ? "bg-blue-500/10 border border-blue-500/20"
                            : isSentStatus ? "bg-emerald-500/10 border border-emerald-500/20"
                            : req.status === "rejected" ? "bg-zinc-800 border border-zinc-700"
                            : "bg-red-500/10 border border-red-500/20"
                        )}>
                          <Mail className={cn(
                            "w-3 h-3",
                            isSentStatus && customerRedeemed ? "text-blue-400"
                              : isSentStatus ? "text-emerald-400"
                              : req.status === "rejected" ? "text-zinc-600"
                              : "text-red-400"
                          )} />
                        </div>
                        <p className="text-xs font-semibold text-white truncate flex-1 min-w-0">{req.email}</p>
                        <span className={cn(
                          "text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0",
                          isSentStatus ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                            : req.status === "rejected" ? "text-zinc-600 bg-zinc-800 border-zinc-700"
                            : "text-amber-400 bg-amber-500/10 border-amber-500/20"
                        )}>
                          {req.status.toUpperCase()}
                        </span>
                        <button
                          data-testid={`button-del-email-${req.id}`}
                          onClick={() => delEmailReq.mutate(req.id)}
                          className="p-1.5 rounded hover:bg-red-500/10 text-zinc-700 hover:text-red-400 transition-colors shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Row 2: payment ref + discord + amount + badges */}
                      <div className="pl-8 space-y-1">
                        <p className="text-[10px] text-zinc-500">
                          <span className="uppercase font-bold text-zinc-600">{req.paymentMethod}</span>
                          {" — "}
                          <span className="font-mono break-all">{req.paymentRef}</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {(req as any).discordUsername && (
                            <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded">
                              Discord: {(req as any).discordUsername}
                            </span>
                          )}
                          {(req as any).amountPaid != null && (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                              Paid: ${(req as any).amountPaid}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {isSentStatus && (
                            customerRedeemed ? (
                              <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border text-blue-400 bg-blue-500/10 border-blue-500/20">
                                <Check className="w-2.5 h-2.5" /> Redeemed
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border text-zinc-500 bg-zinc-800/50 border-zinc-700">
                                <Clock className="w-2.5 h-2.5" /> Awaiting Redemption
                              </span>
                            )
                          )}
                          {deployStat && (() => {
                            const fps = estimateFpsGain(deployStat.allTweakIds);
                            return (
                              <>
                                <span
                                  data-testid={`badge-tweaks-deployed-${req.id}`}
                                  className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border text-red-400 bg-red-500/10 border-red-500/20"
                                >
                                  <Zap className="w-2.5 h-2.5" />
                                  {deployStat.totalTweaks} tweaks
                                </span>
                                {fps.high > 0 && (
                                  <span
                                    data-testid={`badge-fps-est-${req.id}`}
                                    className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                  >
                                    <TrendingUp className="w-2.5 h-2.5" />
                                    +{fps.low}–{fps.high} FPS
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        {sentCode && (
                          <p className="text-[10px] text-zinc-700 font-mono">
                            Code: <span className="text-zinc-500">{sentCode.code}</span>
                            {customerRedeemed && sentCode.usedAt && (
                              <span className="text-blue-600 ml-2">· redeemed {timeAgo(sentCode.usedAt)}</span>
                            )}
                          </p>
                        )}
                        <p className="text-[10px] text-zinc-700 whitespace-nowrap">{timeAgo(req.createdAt)} · {fmt(req.createdAt)}</p>
                        {req.note && <p className="text-[10px] text-zinc-600 italic">{req.note}</p>}

                        {/* Action buttons */}
                        {req.status === "pending" && (
                          <div className="flex gap-2 pt-1.5">
                            <button
                              data-testid={`button-send-email-${req.id}`}
                              onClick={() => sendEmailCode.mutate(req.id)}
                              disabled={sendEmailCode.isPending}
                              className="flex items-center justify-center gap-1.5 flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-black transition-colors disabled:opacity-50"
                            >
                              <Send className="w-3 h-3" />
                              Send Code Now
                            </button>
                            <button
                              data-testid={`button-reject-email-${req.id}`}
                              onClick={() => rejectEmailReq.mutate(req.id)}
                              disabled={rejectEmailReq.isPending}
                              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 text-xs font-bold transition-colors"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Reject
                            </button>
                          </div>
                        )}
                        {/* Revoke — kills active Pro sessions for this customer instantly */}
                        {isSentStatus && sentCode && (
                          <button
                            data-testid={`button-revoke-${req.id}`}
                            onClick={() => {
                              if (confirm(`Revoke ALL Pro access for ${req.email}?\n\nThis kills their session immediately. They will lose access on their next page load.`))
                                revokeByCode.mutate(sentCode.code);
                            }}
                            disabled={revokeByCode.isPending}
                            className="flex items-center gap-1.5 mt-1.5 px-3 py-1.5 rounded-lg bg-red-950/60 border border-red-500/20 text-red-400 hover:bg-red-900/60 hover:border-red-500/40 text-[10px] font-bold transition-colors disabled:opacity-50"
                          >
                            <XCircle className="w-3 h-3" />
                            Revoke Pro Access
                          </button>
                        )}
                      </div>
                    </div>
                  );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ─── PRO SESSIONS TAB ──────────────────────────────────────── */}
        {tab === "sessions" && (() => {
          const sessions = sessionsQuery.data ?? [];
          const now = Date.now();
          // Clients heartbeat every 20 seconds. Allow brief sleep/network gaps.
          const isOnline = (s: { lastCheckedAt: string | null }) =>
            s.lastCheckedAt ? now - new Date(s.lastCheckedAt).getTime() < 2 * 60_000 : false;
          const onlineCount = sessions.filter(isOnline).length;

          // Orphan sessions: codeRef doesn't start with admin-/friend: AND doesn't match any real code
          const validCodeSet = new Set((codesQuery.data ?? []).map(c => c.code));
          const orphanSessions = sessions.filter(s => {
            const ref = s.codeRef ?? "";
            if (!ref || ref.startsWith("admin-") || ref.startsWith("friend:")) return false;
            return !validCodeSet.has(ref);
          });

          return (
            <div className="space-y-4">
              {/* Orphan warning — shown whenever there are unmatched sessions */}
              {orphanSessions.length > 0 && (
                <div
                  data-testid="banner-orphan-sessions"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-500/40 bg-red-500/8"
                >
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 animate-pulse" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-red-300">
                      {orphanSessions.length} orphan session{orphanSessions.length !== 1 ? "s" : ""} detected
                    </p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      These sessions have no matching code in the database. They may be from deleted codes or old data —
                      anyone holding them currently has free Pro access.
                    </p>
                  </div>
                  <button
                    data-testid="button-sweep-orphans"
                    onClick={() => {
                      if (confirm(`Delete all ${orphanSessions.length} orphan session${orphanSessions.length !== 1 ? "s" : ""}?\n\nThose users will lose Pro access immediately on their next page load. This cannot be undone.`))
                        sweepOrphans.mutate();
                    }}
                    disabled={sweepOrphans.isPending}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    {sweepOrphans.isPending ? "Sweeping…" : "Sweep Now"}
                  </button>
                </div>
              )}

              {/* Summary bar */}
              <div className="rounded-xl border border-white/5 bg-zinc-900/40 overflow-hidden">
                {/* Top row: count + actions */}
                <div className="flex items-center gap-3 px-3 py-2.5 border-b border-white/5">
                  <Users className="w-4 h-4 text-zinc-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white">{sessions.length} active Pro session{sessions.length !== 1 ? "s" : ""}</p>
                  </div>
                  <button
                    data-testid="button-sweep-orphans-quiet"
                    onClick={() => sweepOrphans.mutate()}
                    disabled={sweepOrphans.isPending}
                    title="Sweep orphan sessions (sessions with no matching code)"
                    className="p-1.5 rounded hover:bg-red-500/10 text-zinc-700 hover:text-red-400 transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    data-testid="button-refresh-sessions"
                    onClick={() => sessionsQuery.refetch()}
                    className="p-1.5 rounded hover:bg-white/5 text-zinc-600 hover:text-zinc-300 transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", sessionsQuery.isFetching && "animate-spin")} />
                  </button>
                </div>

                {/* Online now panel */}
                <div className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.7)]" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-400">
                      {onlineCount > 0 ? `${onlineCount} online now` : "Nobody online right now"}
                    </p>
                    <span className="text-[9px] text-zinc-700 ml-1">· last 15 min</span>
                  </div>

                  {onlineCount === 0 ? (
                    <p className="text-[10px] text-zinc-700 italic">No users have checked in recently.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {sessions
                        .filter(isOnline)
                        .sort((a, b) =>
                          new Date(b.lastCheckedAt ?? 0).getTime() - new Date(a.lastCheckedAt ?? 0).getTime()
                        )
                        .map(s => {
                          const name = s.discordUsername ?? s.email?.split("@")[0] ?? s.codeNote?.split(" | ")[0] ?? s.tokenMasked;
                          const minutesAgo = s.lastCheckedAt
                            ? Math.floor((Date.now() - new Date(s.lastCheckedAt).getTime()) / 60_000)
                            : null;
                          return (
                            <div
                              key={s.id}
                              data-testid={`chip-online-${s.id}`}
                              className="flex items-center gap-1.5 bg-emerald-950/30 border border-emerald-500/20 rounded-lg px-2 py-1"
                              title={`Last seen: ${minutesAgo === 0 ? "just now" : `${minutesAgo}m ago`}${s.ipCity ? ` · ${[s.ipCity, s.ipCountry].filter(Boolean).join(", ")}` : ""}`}
                            >
                              {/* Avatar: letter fallback always rendered underneath; img overlays it and hides on error */}
                              <div className="relative w-5 h-5 shrink-0">
                                <div className="absolute inset-0 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                                  <span className="text-[8px] text-zinc-500 font-bold uppercase">{name.charAt(0)}</span>
                                </div>
                                {s.discordAvatarUrl && (
                                  <img
                                    src={s.discordAvatarUrl}
                                    alt={name}
                                    className="absolute inset-0 w-5 h-5 rounded-full ring-1 ring-emerald-500/30 object-cover"
                                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                  />
                                )}
                              </div>
                              <span className="text-[11px] text-emerald-300 font-semibold max-w-[120px] truncate">{name}</span>
                              <span className={cn("text-[8px] font-black rounded px-1 py-0.5", s.isPro ? "bg-amber-500/15 text-amber-300" : "bg-zinc-800 text-zinc-400")}>{s.isPro ? "PRO" : "FREE"}</span>
                              {minutesAgo !== null && (
                                <span className="text-[9px] text-emerald-600 shrink-0">
                                  {minutesAgo === 0 ? "now" : `${minutesAgo}m`}
                                </span>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>

              {/* Session breakdown — shows exactly where all sessions come from */}
              {sessions.length > 0 && (() => {
                const fromCodes   = sessions.filter(s => s.codeRef && !s.codeRef.startsWith("admin-") && !s.codeRef.startsWith("friend:") && validCodeSet.has(s.codeRef)).length;
                const fromFriends = sessions.filter(s => s.codeRef?.startsWith("friend:")).length;
                const fromAdmin   = sessions.filter(s => s.codeRef?.startsWith("admin-")).length;
                const fromOrphans = orphanSessions.length;
                return (
                  <div className="grid grid-cols-4 gap-2" data-testid="session-breakdown">
                    {[
                      { label: "Real codes",    count: fromCodes,   color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
                      { label: "Friend links",  count: fromFriends, color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
                      { label: "Admin test",    count: fromAdmin,   color: "text-violet-400",  bg: "bg-violet-500/10 border-violet-500/20" },
                      { label: "Orphans",       count: fromOrphans, color: fromOrphans > 0 ? "text-red-400" : "text-zinc-600", bg: fromOrphans > 0 ? "bg-red-500/10 border-red-500/30" : "bg-zinc-900 border-zinc-800" },
                    ].map(({ label, count, color, bg }) => (
                      <div key={label} className={cn("rounded-lg border px-3 py-2 text-center", bg)}>
                        <p className={cn("text-base font-bold", color)}>{count}</p>
                        <p className="text-[9px] text-zinc-600 uppercase tracking-wider mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}

              <div className="text-[10px] text-zinc-600 leading-relaxed">
                Each row is a Discord-authenticated website or Windows app session. "Online" means its secure heartbeat arrived in the last 2 minutes. Pro/free status comes from the server.
              </div>

              {sessionsQuery.isLoading ? (
                <div className="p-12 text-center text-xs text-zinc-600 animate-pulse">Loading sessions…</div>
              ) : sessions.length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="w-8 h-8 text-zinc-800 mx-auto mb-3" />
                  <p className="text-xs text-zinc-600">No active Pro sessions yet.</p>
                  <p className="text-[10px] text-zinc-700 mt-1">Sessions appear here once a customer redeems a code.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-white/5 overflow-hidden divide-y divide-white/5">
                  {[...sessions]
                    .sort((a, b) => (isOnline(b) ? 1 : 0) - (isOnline(a) ? 1 : 0) ||
                      new Date(b.lastCheckedAt ?? 0).getTime() - new Date(a.lastCheckedAt ?? 0).getTime())
                    .map(s => {
                      const online = isOnline(s);
                      const isFriend = s.codeRef?.startsWith("friend:");
                      const isAdminTest = s.codeRef?.startsWith("admin-");
                      const isOrphan = !isFriend && !isAdminTest && !!s.codeRef && !validCodeSet.has(s.codeRef);
                      const anonymousIpLabel = s.ipAddress
                        ? s.ipAddress.includes(".")
                          ? `${s.ipAddress.split(".")[0]}.x.x.x`
                          : `${s.ipAddress.split(":")[0]}:…`
                        : null;
                      return (
                        <div
                          key={s.id}
                          data-testid={`row-session-${s.id}`}
                          className={cn(
                            "px-3 py-3 transition-colors",
                            isOrphan ? "bg-red-950/20 border-l-2 border-l-red-500/60" :
                            online ? "hover:bg-emerald-950/10" : "opacity-60 hover:opacity-80"
                          )}
                        >
                          {/* Row 1: status dot + identity */}
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className={cn(
                              "w-2 h-2 rounded-full shrink-0 ring-2",
                              online
                                ? "bg-emerald-400 ring-emerald-400/30 shadow-[0_0_6px_rgba(52,211,153,0.5)]"
                                : "bg-zinc-700 ring-zinc-700/30"
                            )} />
                            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/10 bg-zinc-900">
                              {s.discordAvatarUrl ? <img src={s.discordAvatarUrl} alt={s.discordUsername ?? "Discord user"} className="h-full w-full object-cover" /> : null}
                            </div>
                            <div className="flex-1 min-w-0">
                              {s.email ? (
                                <p className="text-xs font-semibold text-white truncate">{s.email}</p>
                              ) : s.codeNote && !isFriend && !isAdminTest && !isOrphan ? (
                                <p className="text-xs font-semibold text-amber-300 truncate">{s.codeNote.split(" | stripe:")[0]}</p>
                              ) : (
                                <p className={cn("text-xs font-semibold italic", isOrphan ? "text-red-400" : "text-zinc-500")}>
                                  {isFriend
                                    ? "Friend link user"
                                    : isAdminTest
                                      ? "Admin test session"
                                      : isOrphan
                                        ? "⚠ ORPHAN — code deleted"
                                        : s.codeRef ?? (anonymousIpLabel ? `Unknown user · ${anonymousIpLabel}` : "Unknown user")}
                                </p>
                              )}
                              {s.discordUsername && (
                                <p className="text-[10px] text-indigo-400 font-bold truncate">Discord: {s.discordUsername}</p>
                              )}
                              {s.ipAddress && (
                                <p className="text-[10px] text-zinc-500 font-mono truncate">
                                  IP: {s.ipAddress}
                                  {(s.ipCity || s.ipRegion) && (
                                    <span className="text-zinc-400 not-italic ml-1.5">
                                      — {[s.ipCity, s.ipRegion, s.ipCountry].filter(Boolean).join(", ")}
                                    </span>
                                  )}
                                </p>
                              )}
                            </div>
                            <span className={cn(
                              "text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0",
                              online
                                ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                : "text-zinc-600 bg-zinc-800 border-zinc-700"
                            )}>
                              {online ? "ONLINE" : "OFFLINE"}
                            </span>
                            <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded border", s.isPro ? "border-amber-500/25 bg-amber-500/10 text-amber-300" : "border-zinc-700 bg-zinc-900 text-zinc-400")}>
                              {s.isPro ? "PRO" : "FREE"}
                            </span>
                            {s.discordId && (
                              <button
                                data-testid={`button-graphics-studio-${s.id}`}
                                onClick={() => {
                                  if (graphicsGrantedIds.has(s.discordId!)) {
                                    if (confirm(`Revoke Graphics Studio from ${s.discordUsername ?? s.discordId}?`))
                                      revokeGraphicsStudio.mutate(s.discordId!);
                                  } else {
                                    if (confirm(`Grant Graphics Studio to ${s.discordUsername ?? s.discordId}?`))
                                      grantGraphicsStudio.mutate(s.discordId!);
                                  }
                                }}
                                disabled={grantGraphicsStudio.isPending || revokeGraphicsStudio.isPending}
                                className={cn(
                                  "p-1.5 rounded transition-colors shrink-0",
                                  graphicsGrantedIds.has(s.discordId)
                                    ? "text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                                    : "text-zinc-600 hover:bg-zinc-700/30 hover:text-zinc-400"
                                )}
                                title={graphicsGrantedIds.has(s.discordId) ? "Revoke Graphics Studio" : "Grant Graphics Studio"}
                              >
                                <Palette className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {s.sessionToken && <button
                              data-testid={`button-revoke-session-${s.id}`}
                              onClick={() => {
                                if (confirm(`Revoke session for ${s.email ?? s.tokenMasked}?\n\nThey lose Pro access immediately.`))
                                  revokeSession.mutate(s.sessionToken!);
                              }}
                              disabled={revokeSession.isPending}
                              className="p-1.5 rounded hover:bg-red-500/10 text-zinc-700 hover:text-red-400 transition-colors shrink-0"
                              title="Revoke this session"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>}
                          </div>

                          {/* Row 2: code info + timestamps */}
                          <div className="pl-4 space-y-0.5">
                            {s.codeRef && (
                              <p className="text-[10px] text-zinc-600 font-mono">
                                <span className="text-zinc-700 uppercase font-bold">Code: </span>
                                {isFriend ? (
                                  <span className="text-amber-600">friend link</span>
                                ) : isAdminTest ? (
                                  <span className="text-violet-600">admin test</span>
                                ) : (
                                  <span className="text-zinc-500">{s.codeRef}</span>
                                )}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                              <p className="text-[10px] text-zinc-700">
                                <span className="text-zinc-600">Activated: </span>
                                {s.createdAt ? timeAgo(s.createdAt) : "—"}
                              </p>
                              <p className="text-[10px] text-zinc-700">
                                <span className="text-zinc-600">Last active: </span>
                                {s.lastCheckedAt ? timeAgo(s.lastCheckedAt) : "—"}
                              </p>
                              <p className="text-[10px] text-zinc-800 font-mono">Token: {s.tokenMasked}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })()}

        {/* ─── ANNOUNCEMENTS TAB ────────────────────────────────────── */}
        {tab === "announcements" && (
          <div className="space-y-4">

            {/* Live Download Status */}
            {(() => {
              const rd = resolvedDownloadQ.data;
              const sourceLabels: Record<string, string> = {
                github: "GitHub Release",
                local: "Local file",
                env: "DOWNLOAD_URL env",
                admin_override: "Admin override",
                none: "No installer",
                error: "Error",
              };
              const sourceColors: Record<string, string> = {
                github: "border-emerald-500/25 bg-emerald-500/[0.04]",
                local: "border-blue-500/25 bg-blue-500/[0.04]",
                env: "border-yellow-500/25 bg-yellow-500/[0.04]",
                admin_override: "border-yellow-500/25 bg-yellow-500/[0.04]",
                none: "border-zinc-700 bg-white/[0.02]",
                error: "border-red-500/25 bg-red-500/[0.04]",
              };
              const dotColors: Record<string, string> = {
                github: "bg-emerald-400 animate-pulse",
                local: "bg-blue-400 animate-pulse",
                env: "bg-yellow-400 animate-pulse",
                admin_override: "bg-yellow-400 animate-pulse",
                none: "bg-zinc-600",
                error: "bg-red-400",
              };
              const labelColors: Record<string, string> = {
                github: "text-emerald-400",
                local: "text-blue-400",
                env: "text-yellow-400",
                admin_override: "text-yellow-400",
                none: "text-zinc-500",
                error: "text-red-400",
              };
              const src = rd?.source ?? "none";
              return (
                <div
                  className={`rounded-xl border p-4 space-y-2 ${sourceColors[src] ?? "border-zinc-700 bg-white/[0.02]"}`}
                  data-testid="section-live-download"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${dotColors[src] ?? "bg-zinc-600"}`} />
                    <span className={`text-xs font-bold uppercase tracking-wider ${labelColors[src] ?? "text-zinc-500"}`}>
                      Live download — {sourceLabels[src] ?? src}
                    </span>
                  </div>
                  {rd ? (
                    <div className="space-y-1 text-[11px] pl-4">
                      {rd.version && (
                        <div className="text-zinc-400">
                          Version served: <span className="text-white font-mono font-bold">v{rd.version}</span>
                        </div>
                      )}
                      {rd.url && (
                        <div className="text-zinc-400 truncate">
                          URL: <span className="text-zinc-300 font-mono">{rd.url}</span>
                        </div>
                      )}
                      {rd.filename && (
                        <div className="text-zinc-400">
                          File: <span className="text-zinc-300 font-mono">{rd.filename}</span>
                        </div>
                      )}
                      {src === "none" && (
                        <div className="text-zinc-500">No installer is available yet. Set DOWNLOAD_URL, drop an .exe in client/public/downloads/, or publish a GitHub Release.</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[10px] text-zinc-600 pl-4">Resolving…</div>
                  )}
                </div>
              );
            })()}

            {/* GitHub Auto-Detect */}
            <div className={`rounded-xl border p-4 space-y-3 ${ghReleaseQ.data?.version ? "border-emerald-500/25 bg-emerald-500/[0.04]" : "border-zinc-700 bg-white/[0.02]"}`} data-testid="section-version-updates">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${ghReleaseQ.data?.version ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
                  <span className={`text-xs font-bold uppercase tracking-wider ${ghReleaseQ.data?.version ? "text-emerald-400" : "text-zinc-500"}`}>
                    {ghReleaseQ.data?.version ? "GitHub auto-detect: live" : "GitHub auto-detect: offline"}
                  </span>
                </div>
                <button
                  data-testid="button-gh-refresh"
                  onClick={refreshGhRelease}
                  disabled={ghRefreshing}
                  className="text-zinc-400 hover:text-white text-[10px] font-mono border border-white/10 rounded px-2 py-0.5 hover:border-white/20 transition-colors disabled:opacity-40"
                >
                  {ghRefreshing ? "…" : "↺ Refresh"}
                </button>
              </div>

              {ghReleaseQ.data?.version ? (
                <div className="space-y-1 text-[11px] pl-4">
                  <div className="text-zinc-400">Version: <span className="text-white font-mono font-bold">v{ghReleaseQ.data.version}</span></div>
                  <div className="text-zinc-400 truncate">Download: <span className="text-zinc-300 font-mono">{ghReleaseQ.data.exeUrl ?? "—"}</span></div>
                  {ghReleaseQ.data.fetchedAt && (
                    <div className="text-zinc-600">Cached {Math.round((Date.now() - ghReleaseQ.data.fetchedAt) / 60000)}m ago · auto-refreshes every 10m</div>
                  )}
                </div>
              ) : (
                <p className="text-[10px] text-zinc-600 pl-4">Could not reach GitHub. Use the override below to force an update prompt.</p>
              )}
            </div>

            <p className="text-[10px] text-zinc-600 leading-relaxed">
              Push to GitHub → Actions builds the .exe → Replit detects the new release within 10 min → anyone on an older version sees the update splash on next launch. <span className="text-zinc-400">No action needed.</span>
            </p>

            {/* Manual override — only needed to force/test */}
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-3">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Force override <span className="text-zinc-600 normal-case font-normal">(leave blank to use GitHub auto)</span></h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1 block">Latest version</label>
                  <input
                    data-testid="input-version-latest"
                    value={verLatest}
                    onChange={e => setVerLatest(e.target.value)}
                    placeholder={ghReleaseQ.data?.version ? `Auto: ${ghReleaseQ.data.version}` : "e.g. 2.3.7"}
                    className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-red-500/40"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1 block">Download URL</label>
                  <input
                    data-testid="input-version-cmd-url"
                    value={verCmdUrl}
                    onChange={e => setVerCmdUrl(e.target.value)}
                    placeholder={ghReleaseQ.data?.exeUrl ?? "Auto from GitHub"}
                    className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-red-500/40"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  data-testid="button-save-version-settings"
                  onClick={saveVersionSettings}
                  disabled={verSaving}
                  className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
                >
                  {verSaving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>

          </div>
        )}

        {/* ─── IMPACT ANALYTICS TAB ──────────────────────────────────── */}
        {tab === "analytics" && (
          <div className="space-y-5">
            <div className="text-[10px] text-zinc-600 leading-relaxed">
              Every time a user downloads a script, the tweaks they had enabled are recorded. Data is fully anonymous — no IP, no account info, just tweak IDs and timestamps.
            </div>

            <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-300">Social Campaign Conversions</h3>
                <span className="text-[9px] text-zinc-600">anonymous campaign totals</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[10px]">
                  <thead className="text-zinc-600 uppercase">
                    <tr><th className="pb-2">Platform / Campaign</th><th>Visits</th><th>Downloads</th><th>Discord clicks</th><th>Pro buyers</th><th>Qualified</th></tr>
                  </thead>
                  <tbody>
                    {(marketingAttributionQuery.data ?? []).map(row => (
                      <tr key={`${row.platform}:${row.campaign}`} className="border-t border-white/5">
                        <td className="py-2"><span className="text-white font-bold capitalize">{row.platform}</span><span className="text-zinc-600 ml-2 font-mono">{row.campaign}</span></td>
                        <td>{row.landingVisits}</td><td>{row.installerDownloads}</td><td>{row.discordJoins}</td>
                        <td className="text-emerald-400 font-bold">{row.proPurchases}</td><td className="text-red-400 font-bold">{row.qualifiedConversions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!marketingAttributionQuery.isLoading && !(marketingAttributionQuery.data?.length) && (
                  <p className="py-5 text-center text-zinc-700">No tracked campaign traffic yet.</p>
                )}
              </div>
            </div>

            {downloadStatsQuery.isLoading ? (
              <div className="flex items-center gap-3 py-10 justify-center text-zinc-600 text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading analytics...
              </div>
            ) : (() => {
              const ds = downloadStatsQuery.data;
              if (!ds) return <div className="text-zinc-600 text-sm py-6 text-center">No data yet</div>;

              const maxDay = Math.max(...ds.last7Days.map(d => d.count), 1);
              const maxTweak = Math.max(...ds.topTweaks.map(t => t.count), 1);

              return (
                <div className="space-y-5">
                  {/* Hero stats */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      {
                        label: "Scripts Downloaded",
                        value: ds.totalDownloads.toLocaleString(),
                        sub: "total users helped",
                        color: "text-red-400",
                        icon: <TrendingUp className="w-4 h-4 text-red-400" />,
                      },
                      {
                        label: "Tweaks Deployed",
                        value: ds.totalTweaksDeployed.toLocaleString(),
                        sub: "applied across all users",
                        color: "text-emerald-400",
                        icon: <Zap className="w-4 h-4 text-emerald-400" />,
                      },
                      {
                        label: "Avg per Script",
                        value: `${ds.avgTweaksPerDownload}`,
                        sub: "tweaks per download",
                        color: "text-blue-400",
                        icon: <BarChart3 className="w-4 h-4 text-blue-400" />,
                      },
                    ].map((s) => (
                      <div key={s.label} className="relative p-4 rounded-xl border border-white/5 bg-zinc-900/40 overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">{s.label}</p>
                          {s.icon}
                        </div>
                        <p className={`text-3xl font-black font-mono ${s.color}`}>{s.value}</p>
                        <p className="text-[10px] text-zinc-700 mt-1">{s.sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* 7-day trend bar chart */}
                  <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart3 className="w-3.5 h-3.5 text-zinc-500" />
                      <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Downloads — Last 7 Days</h3>
                    </div>
                    <div className="flex items-end gap-2 h-24">
                      {ds.last7Days.map((day) => {
                        const barH = maxDay > 0 ? Math.max((day.count / maxDay) * 100, day.count > 0 ? 8 : 2) : 2;
                        const label = new Date(day.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
                        return (
                          <div key={day.date} className="flex-1 flex flex-col items-center gap-1" title={`${day.date}: ${day.count} downloads`}>
                            <span className="text-[9px] text-zinc-600 font-mono">{day.count > 0 ? day.count : ""}</span>
                            <div className="w-full rounded-t-sm bg-red-500/70" style={{ height: `${barH}%`, minHeight: "2px" }} />
                            <span className="text-[8px] text-zinc-700 font-bold">{label}</span>
                          </div>
                        );
                      })}
                    </div>
                    {ds.last7Days.every(d => d.count === 0) && (
                      <p className="text-[10px] text-zinc-700 text-center mt-2">No downloads in the last 7 days yet — data populates as users download scripts.</p>
                    )}
                  </div>

                  {/* Top tweaks */}
                  {ds.topTweaks.length > 0 ? (
                    <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Flame className="w-3.5 h-3.5 text-red-500" />
                        <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Most Popular Tweaks</h3>
                        <span className="ml-auto text-[9px] text-zinc-700">top {ds.topTweaks.length} by frequency</span>
                      </div>
                      <div className="space-y-2">
                        {ds.topTweaks.map((t, i) => (
                          <div key={t.tweakId} className="flex items-center gap-3">
                            <span className="text-[9px] font-bold text-zinc-700 w-4 shrink-0 text-right">{i + 1}</span>
                            <span className="text-[11px] font-mono text-zinc-300 w-44 shrink-0 truncate" title={t.tweakId}>{t.tweakId}</span>
                            <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400"
                                style={{ width: `${(t.count / maxTweak) * 100}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-mono text-zinc-500 w-8 text-right shrink-0">{t.count}×</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-6 text-center">
                      <Flame className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
                      <p className="text-xs text-zinc-600">Top tweaks will appear here after the first script is downloaded.</p>
                    </div>
                  )}

                  {/* Recent script generations */}
                  <div className="rounded-xl border border-white/5 bg-zinc-900/40 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                      <Activity className="w-3.5 h-3.5 text-emerald-500" />
                      <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Recent Script Generations</h3>
                      <span className="ml-auto text-[9px] text-zinc-700">last {Math.min(ds.recentDownloads?.length ?? 0, 30)} events</span>
                    </div>
                    {!ds.recentDownloads || ds.recentDownloads.length === 0 ? (
                      <div className="py-8 text-center">
                        <Activity className="w-5 h-5 text-zinc-700 mx-auto mb-2" />
                        <p className="text-[10px] text-zinc-700">No script generations yet. Data appears here when users download their optimization script.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-white/5">
                        {ds.recentDownloads.map((dl) => {
                          const when = timeAgo(dl.downloadedAt);
                          const topIds = dl.tweakIds.slice(0, 4);
                          const extra = dl.tweakIds.length - topIds.length;
                          const heat = dl.tweakCount >= 50 ? "text-red-400" : dl.tweakCount >= 25 ? "text-amber-400" : "text-emerald-400";
                          return (
                            <div key={dl.id} data-testid={`row-download-${dl.id}`} className="flex items-start gap-3 px-4 py-2.5 hover:bg-white/2 transition-colors">
                              <span className="text-[9px] text-zinc-700 font-mono w-5 shrink-0 pt-0.5 text-right">#{dl.id}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {topIds.map(tid => (
                                    <span key={tid} className="text-[9px] font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded truncate max-w-[140px]" title={tid}>{tid}</span>
                                  ))}
                                  {extra > 0 && <span className="text-[9px] text-zinc-600">+{extra} more</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-[11px] font-black font-mono ${heat}`}>{dl.tweakCount}</span>
                                <span className="text-[9px] text-zinc-700">tweaks</span>
                                <span className="text-[9px] text-zinc-600 pl-1">{when}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {tab === "security" && <SecurityTab headers={headers} />}
        {tab === "preset" && (
          <AdminPresetGenerator
            key={presetFillKey}
            initialValues={presetFillData ?? undefined}
            allHardware={(() => {
              // Merge both sources, dedup by codeRef (rig wins — richer data)
              const seen = new Set<string>();
              const merged: CustomerHW[] = [];
              for (const r of (Array.isArray(rigsDetectedQuery.data) ? rigsDetectedQuery.data : [])) {
                if (!seen.has(r.codeRef)) { seen.add(r.codeRef); merged.push({ ...r, source: "rig" as const }); }
              }
              for (const h of (Array.isArray(customerHardwareQuery.data) ? customerHardwareQuery.data : [])) {
                if (!seen.has(h.codeRef)) { seen.add(h.codeRef); merged.push({ ...h, source: "hw" as const }); }
              }
              return merged;
            })()}
            allCodes={(codesQuery.data || []).map(c => ({ code: c.code, note: c.note ?? null }))}
            apiKey={key}
            onRefresh={() => {
              rigsDetectedQuery.refetch();
              customerHardwareQuery.refetch();
            }}
          />
        )}

        {tab === "aether" && <AetherAdminChat headers={headers} />}
        {tab === "tickets" && <TicketsTab headers={headers} />}
        {tab === "pro" && <ProUsersTab headers={headers} />}
        {tab === "discounts" && <DiscountsTab headers={headers} />}
        {tab === "rigs" && <HardwareDbTab headers={headers} />}
        {tab === "suggestions" && <SuggestionsInboxTab headers={headers} />}
        {tab === "drivers" && <NvidiaTrackerTab headers={headers} />}
        {tab === "fivem" && <FivemServersTab headers={headers} />}
        {tab === "hud" && <HudEditorTab headers={headers} />}

        {/* ─── MOBILE FLOATING ACTION BAR ───────────────────────────── */}
        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
          <div className="bg-zinc-950/95 border-t border-white/8 backdrop-blur-xl px-4 py-3 pb-safe-area-inset-bottom">
            <div className="flex items-center gap-2">
              {/* Quick Generate Code */}
              <button
                data-testid="mobile-fab-gen-code"
                onClick={() => { setTab("codes"); genCode.mutate(); }}
                disabled={genCode.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-sm transition-all shadow-[0_4px_20px_-4px_rgba(239,68,68,0.5)] active:scale-95"
              >
                <Plus className="w-4 h-4" />
                {genCode.isPending ? "Generating..." : "Gen Code"}
              </button>

              {/* Email Tab Shortcut */}
              <button
                data-testid="mobile-fab-email"
                onClick={() => setTab("email")}
                className={cn(
                  "relative flex items-center justify-center w-12 h-12 rounded-xl border transition-all active:scale-95",
                  tab === "email"
                    ? "bg-red-500/15 border-red-500/40 text-red-400"
                    : "bg-zinc-800/80 border-zinc-700 text-zinc-400"
                )}
              >
                <Mail className="w-5 h-5" />
                {pendingEmailCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-[8px] font-bold text-white flex items-center justify-center">
                    {pendingEmailCount}
                  </span>
                )}
              </button>

              {/* Quick Send Now (if pending) */}
              {pendingEmailCount > 0 && sys?.enabled && (
                <button
                  data-testid="mobile-fab-send-now"
                  onClick={() => triggerAutoSend.mutate()}
                  disabled={triggerAutoSend.isPending}
                  className="flex items-center justify-center gap-1.5 px-3 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs transition-all active:scale-95"
                >
                  <PlayCircle className="w-4 h-4" />
                  Send All
                </button>
              )}

              {/* Security / Aether Shortcut */}
              <button
                data-testid="mobile-fab-security"
                onClick={() => setTab("security")}
                className={cn(
                  "relative flex items-center justify-center w-12 h-12 rounded-xl border transition-all active:scale-95",
                  tab === "security"
                    ? "bg-red-500/15 border-red-500/40 text-red-400"
                    : "bg-zinc-800/80 border-zinc-700 text-zinc-400"
                )}
                title="Aether Security"
              >
                <Shield className="w-5 h-5" />
              </button>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="flex items-center justify-center w-12 h-12 rounded-xl bg-zinc-800/80 border border-zinc-700 text-zinc-500 transition-all active:scale-95"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
