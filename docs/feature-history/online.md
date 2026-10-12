# Online — "Play Online" and the shared arena

What the code does not show:

- **Why the game finds its own room.** The requirement is one press: "Play Online" → an arena with
  people on it. The catalog's `multiplayer` system is a lobby for playing with friends (create a
  room, invite, "Ready", the host presses "Play") — the wrong shape for an .io arena. So
  `net/matchmaking.ts` uses the engine's rooms directly (`client.multiplayer.listRooms` +
  `RealtimeSession.join` / `.create`, rooms tagged `mode: "sol-mass"`): the fullest open arena, or a
  new one. **Do not install the catalog's `multiplayer` module next to this as it is**: both would
  own the player's room, and the server allows a player one room at a time. Rooms with invites would
  mean reworking the entry into `ctx.multiplayer.registerGame`.
- **It needs the title's Multiplayer section.** Absent means disabled, and "Play Online" answers
  "Online is not available: Multiplayer is disabled for this title." Saved on 2026-10-12 on both
  the sandbox `JNFMH60I-DEV` and, on the owner's approval, the live `JNFMH60I`:
  `SystemState.Enabled: true`, `DefaultTopology: "Host"`, `DefaultChatMode: "P2P"`,
  `MaxPlayersPerRoom: 12` (the game asks for `ONLINE_MAX_PLAYERS`, the title's number is the cap).
  Online play itself was tested on the sandbox only.
- **There is no game server.** The engine only introduces the players (rooms + WebRTC signaling);
  the arena runs on the device of the room's host and travels peer to peer. Consequences to keep in
  mind before changing anything here:
  - the host plays with no delay, everybody else with their ping to the host — a guest's own cell
    is drawn where the host says it is (no client-side prediction);
  - whoever hosts can cheat, and the final mass still goes to the leaderboard from the client. Fine
    for a hackathon; a game where mass is worth tokens needs an authoritative server (the rules in
    `game/world.ts` have no browser dependencies and can run on one as they are);
  - the engine issues TURN relays only when it has Cloudflare TURN configured (an engine setting,
    not title config); otherwise players behind strict NATs cannot link. A newcomer that cannot
    reach a room's host gives up after 40 s and does not try that room again in the session.
- **The arena must outlive its host**, or one player closing a tab would end it for everybody.
  Every device keeps the whole arena, so the next host just starts simulating its copy: at once
  when the host leaves properly (it names a successor), and after ~17 s of silence when the host's
  tab dies (the server lets a member claim the host role only once the host has not polled for
  `MemberTimeoutMs`, 15 s). Both paths were tested with real browsers; keep them working.
- **A hidden tab does not run requestAnimationFrame**, and its timers drop to one a second — so the
  host's simulation is also driven by a worker's timer (`net/ticker.ts`) while the tab is hidden.
- **Known gap:** two players who press "Play Online" at the same moment while no arena is open each
  open their own; arenas are never merged.
