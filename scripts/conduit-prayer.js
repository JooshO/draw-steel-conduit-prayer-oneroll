/**
 * Draw Steel - Conduit Prayer Module
 * Refactored Version - Clean implementation with proper Draw Steel integration
 *
 * FLOW:
 * 1. Turn starts -> HeroModel._onStartTurn suppresses normal piety gain
 * 2. Dialog appears: "Will you PRAY before rolling?" (only on owning client)
 * 3. Player chooses PRAY or SKIP (before any rolling happens)
 * 4. Roll appropriate amounts based on decision:
 *    - SKIP: Roll 1d3 for baseline piety only
 *    - PRAY: Roll 1d3 baseline + 1d3 prayer effects
 * 5. Apply total piety gain using Draw Steel's /gain enricher system
 */

console.log("INFO: Conduit Prayer module starting...");

// Inject custom CSS for prayer messages
const prayerCSS = `
.ds-conduit-prayer {
  border: 1px solid var(--color-border-light-2);
  padding: 8px;
  border-radius: 5px;
  margin: 4px 0;
}

.ds-conduit-prayer .header {
  flex-basis: 100%;
  text-align: center;
  font-size: var(--font-size-16);
  font-weight: bold;
  margin-bottom: 8px;
}

.ds-conduit-prayer .prayer-details {
  font-size: var(--font-size-13);
  line-height: 1.4;
}

.ds-conduit-prayer .prayer-details p {
  margin: 4px 0;
}
`;

// Add CSS to document head
const styleElement = document.createElement('style');
styleElement.innerHTML = prayerCSS;
document.head.appendChild(styleElement);

// ===== DATA ACCESSORS =====

function getConduitPiety(actor) {
  return actor.system?.hero?.primary?.value ?? 0;
}

function getConduitLevel(actor) {
  return actor.system?.details?.level ?? 1;
}

// ===== CLASS DETECTION =====

function isConduit(actor) {
  if (!actor || actor.type !== "hero") return false;
  return actor.system?.class?.system?._dsid === "conduit";
}

// ===== PRAYER HANDLERS =====

async function handlePrayerFullFlow(actor) {
  try {
    const level = getConduitLevel(actor);

    // Roll 1d3 for baseline piety with dice visualization
    const baselineRoll = new Roll("1d3");
    await baselineRoll.evaluate();
    await baselineRoll.toMessage({
      flavor: `${actor.name} - Baseline Piety Roll`,
      speaker: ChatMessage.getSpeaker({ actor })
    });

    // Get results after dice are shown
    const baseline = baselineRoll.total;

    // Calculate total piety gain
    let totalGain = baseline;
    let htmlContent = "";

    if (baseline === 1) {
      // Prayer result 1: +1 piety + psychic damage
      totalGain = baseline + 1;

      htmlContent = `<div class="dice-roll ds-conduit-prayer">
        <div class="header" style="color: var(--draw-steel-c-failure);">THE GODS ARE ANGERED!</div>
        <div class="prayer-details">
          <p><strong>Prayer Roll:</strong> 1</p>
          <p><strong>Total Piety Gain:</strong> +${totalGain}</p>
          <p><strong>Psychic Damage:</strong> [[/damage 1d6+${level} psychic]] (unblockable)</p>
        </div>
      </div>`;

    } else if (baseline === 2) {
      // Prayer result 2: +1 piety (safe)
      totalGain = baseline + 1;

      htmlContent = `<div class="dice-roll ds-conduit-prayer">
        <div class="header" style="color: var(--draw-steel-c-tan);">DIVINE GRACE</div>
        <div class="prayer-details">
          <p><strong>Prayer Roll:</strong> 2</p>
          <p><strong>Total Piety Gain:</strong> +${totalGain}</p>
        </div>
      </div>`;

    } else if (baseline === 3) {
      // Prayer result 3: +2 piety + domain effect
      totalGain = baseline + 2;

      htmlContent = `<div class="dice-roll ds-conduit-prayer">
        <div class="header" style="color: var(--draw-steel-c-success);">DIVINE FAVOR!</div>
        <div class="prayer-details">
          <p><strong>Prayer Roll:</strong> 3</p>
          <p><strong>Total Piety Gain:</strong> +${totalGain}</p>
          <p><strong>Domain Effect:</strong> Choose one to activate!</p>
        </div>
      </div>`;
    }

    // Apply total piety gain using enricher
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `${htmlContent}\n[[/gain ${totalGain} heroic]]`
    });

  } catch (error) {
    console.error("ERROR: Prayer flow error:", error);
  }
}

async function handleSkipFlow(actor) {
  try {
    // Roll 1d3 for baseline piety only with dice visualization
    const baselineRoll = new Roll("1d3");
    await baselineRoll.evaluate();
    await baselineRoll.toMessage({
      flavor: `${actor.name} - Piety Gain (No Prayer)`,
      speaker: ChatMessage.getSpeaker({ actor })
    });

    const baseline = baselineRoll.total;

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="dice-roll ds-conduit-prayer">
        <div class="header" style="color: var(--draw-steel-c-tan);">Prayer Declined</div>
        <div class="prayer-details">
          <p><strong>${actor.name}</strong> declines to pray and gains <strong>${baseline} Piety</strong>.</p>
        </div>
      </div>\n[[/gain ${baseline} heroic]]`
    });

  } catch (error) {
    console.error("ERROR: Skip flow error:", error);
  }
}


// ===== DIALOG =====

// ===== SOCKET HANDLING =====

async function sendPrayerPromptToPlayer(actor, owningUser) {
  if (game.userId === owningUser.id) {
    // We ARE the owning player - show dialog locally
    await promptConduitPrayer(actor);
  } else {
    // We're not the owning player - send request to them via socket
    const socketData = {
      type: "promptPrayer",
      actorId: actor.id,
      actorName: actor.name,
      requesterId: game.userId,
      requesterName: game.user.name
    };

    // Send to all clients (the owning player will handle it)
    game.socket.emit("module.draw-steel-conduit-prayer", socketData);
  }
}

function setupSocketListener() {
  game.socket.on("module.draw-steel-conduit-prayer", async (message) => {
    if (message.type === "promptPrayer") {
      const actor = game.actors.get(message.actorId);

      // Only handle if we are the owning player
      if (actor && isConduit(actor) && game.user.character?.id === actor.id) {
        await promptConduitPrayer(actor);
      }
    }
  });
}

async function promptConduitPrayer(actor) {
  try {
    const level = getConduitLevel(actor);

    const content = `
      <div class="dialog-content">
        <p><strong>${actor.name}</strong>, it's the start of your turn.</p>
        <p>Will you <strong>PRAY</strong> to the gods before rolling for piety?</p>

        <div class="card">
          <h4>If You Pray (d3 roll determines prayer effects):</h4>
          <ul>
            <li><strong class="danger">Roll 1:</strong> +1 additional piety + 1d6+${level} psychic damage (unblockable)</li>
            <li><strong class="primary">Roll 2:</strong> +1 additional piety (safe)</li>
            <li><strong class="success">Roll 3:</strong> +2 additional piety + activate one domain effect</li>
          </ul>
        </div>

        <p><em>You'll roll 1d3 for baseline piety either way. Prayer adds to that result.</em></p>
      </div>
    `;

    // Use V2 Application framework to avoid deprecation warning
    const choice = await foundry.applications.api.DialogV2.wait({
      window: {
        title: `${actor.name} - Prayer?`
      },
      content,
      buttons: [
        {
          label: 'Pray to the Gods',
          action: 'pray',
          icon: '<i class="fas fa-hands-praying"></i>'
        },
        {
          label: 'Decline Prayer',
          action: 'skip',
          icon: '<i class="fas fa-times-circle"></i>'
        }
      ],
      default: 'pray'
    });

    if (choice === 'pray') {
      await handlePrayerFullFlow(actor);
      return true;
    } else if (choice === 'skip') {
      await handleSkipFlow(actor);
      return true;
    } else {
      // Dialog was closed without a choice - treat as skip
      await handleSkipFlow(actor);
      return true;
    }

  } catch (error) {
    console.error("ERROR: Dialog error:", error);
    return null;
  }
}





// Ready
Hooks.once("ready", () => {
  console.log("INFO: Conduit Prayer Ready");

  // Set up socket listener for cross-client communication
  setupSocketListener();

  // Apply HeroModel wrapper now that Draw Steel is loaded
  const HeroModelClass = window.ds?.data?.Actor?.HeroModel;
  if (HeroModelClass?.prototype) {
    const originalOnStartTurn = HeroModelClass.prototype._onStartTurn;

    // Wrap _onStartTurn to suppress normal piety gain and show prayer dialog
    HeroModelClass.prototype._onStartTurn = async function(combatant) {
      const actor = this.parent;

      // Only intercept Conduit actors
      if (!actor || !isConduit(actor)) {
        // Non-Conduit: use original
        return originalOnStartTurn.call(this, combatant);
      }

      const characterClass = this.class;
      if (characterClass && characterClass.system.turnGain) {
        // Find the owning player
        const owningUser = game.users.contents.find(u => !u.isGM && u.character?.id === actor.id);
        const isPlayerOwned = !!owningUser;

        if (isPlayerOwned) {
          await sendPrayerPromptToPlayer(actor, owningUser);
        } else {
          await promptConduitPrayer(actor);
        }

        // Do NOT call originalOnStartTurn - we've handled it
        return;
      }

      // No turn gain formula: use original
      return originalOnStartTurn.call(this, combatant);
    };

    console.log("INFO: HeroModel._onStartTurn wrapped successfully");
  } else {
    console.warn("WARN: Could not wrap HeroModel methods - class not found at window.ds?.data?.Actor?.HeroModel");
  }
});

