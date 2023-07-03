import "./const.js";

function failureMessageOutcome(message) {
    return "failure" == message?.flags?.pf2e?.context?.outcome;
}

function criticalFailureMessageOutcome(message) {
    return "criticalFailure" == message?.flags?.pf2e?.context?.outcome;
}

function successMessageOutcome(message) {
    return "success" == message?.flags?.pf2e?.context?.outcome;
}

function criticalSuccessMessageOutcome(message) {
    return "criticalSuccess" == message?.flags?.pf2e?.context?.outcome;
}

function anyFailureMessageOutcome(message) {
    return failureMessageOutcome(message) || criticalFailureMessageOutcome(message);
}

function anySuccessMessageOutcome(message) {
    return successMessageOutcome(message) || criticalSuccessMessageOutcome(message);
}

function actorFeat(actor, feat) {
    return actor?.itemTypes?.feat?.find((c => feat === c.slug))
}

function messageType(message, type) {
    return type == message?.flags?.pf2e?.context?.type;
}

function hasOption(message, opt) {
    return message?.flags?.pf2e?.context?.options?.includes(opt);
}

function hasEffect(actor, eff) {
    return actor && actor?.itemTypes?.effect?.find((c => eff === c.slug))
}

function actorsWithEffect(eff) {
    return game.combat.turns.filter(cc=>hasEffect(cc.actor, eff)).map(cc=>cc.actor);
}

function deleteEffectFromActor(a, eff) {
    let eff_id = a.itemTypes.effect.find(c => eff === c.slug)._id
    a.deleteEmbeddedDocuments("Item", [eff_id])
}

function deleteFlatFootedTumbleBehindFromActor(a) {
    let eff_id = a.itemTypes.effect.find(c => "effect-flat-footed-tumble-behind" === c.slug)._id
    a.deleteEmbeddedDocuments("Item", [eff_id])
}

function deleteFlatFootedTumbleBehind() {
    actorsWithEffect("effect-flat-footed-tumble-behind")
    .forEach(a => deleteFlatFootedTumbleBehindFromActor(a));
}

async function setEffectToActor(actor, eff) {
    const source = (await fromUuid(eff)).toObject();
    source.flags = mergeObject(source.flags ?? {}, { core: { sourceId: eff } });

    await actor.createEmbeddedDocuments("Item", [source]);
}

Hooks.on('preCreateChatMessage',async (message, user, _options, userId)=>{
    if (game?.combats?.active) {
        if (messageType(message, 'skill-check') && message?.target?.actor) {
            if (hasOption(message, "action:tumble-through")) {
                if (anySuccessMessageOutcome(message)) {
                    if (actorFeat(message?.actor, "tumble-behind-rogue") && !hasEffect(message.target.actor, "effect-flat-footed-tumble-behind")) {
                        setEffectToActor(message.target.actor, effect_flat_footed)
                    }
                    if (actorFeat(message?.actor, "panache") && !hasEffect(message.actor, "effect-panache")) {
                        setEffectToActor(message.actor, effect_panache)
                    }
                }
            }
            if (hasOption(message, "action:demoralize")) {
                if (successMessageOutcome(message)) {
                    message.target.actor.increaseCondition("frightened", {value: 1 });
                } else if (criticalSuccessMessageOutcome(message)) {
                    message.target.actor.increaseCondition("frightened", {value: 2 });
                }
                if (anySuccessMessageOutcome(message)) {
                    if (actorFeat(message?.actor, "panache") && !hasEffect(message.actor, "effect-panache")) {
                        setEffectToActor(message.actor, effect_panache)
                    }
                }
            }
        } else if (messageType(message, "damage-roll")) {
            if (message?.item?.isMelee && hasEffect(message.actor, "effect-panache") && hasOption(message, "finisher")
                && (hasOption(message, "agile") || hasOption(message, "finesse"))
            ) {
                deleteEffectFromActor(message.actor, "effect-panache")
            }
        }

        if (messageType(message, "attack-roll") && message?.target?.actor && hasEffect(message.target.actor, "effect-flat-footed-tumble-behind")) {
            deleteFlatFootedTumbleBehindFromActor(message.target.actor);
        }
    }
});

Hooks.on('combatTurn', async (combat, updateData, updateOptions) => {
    deleteFlatFootedTumbleBehind();
});

Hooks.on('combatRound', async (combat, updateData, updateOptions) => {
    deleteFlatFootedTumbleBehind();
});