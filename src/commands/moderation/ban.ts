import xlg from "../../xlogger";
import { getPermLevel, permLevels } from '../../permissions';
//import { getGuildSetting } from "../dbmanager";
import { durationToString, stringToMember } from "../../utils/parsers";
import Discord from 'discord.js';
import { Command, UnbanActionData } from "src/gm";
import { stringToDuration } from "../../utils/time";
import moment from "moment";

export const command: Command = {
    name: "ban",
    aliases: ["b"],
    description: {
        short: "ban a member",
        long: "Use to permanently ban a member. This will kick and prevent them from rejoining the server."
    },
    usage: "<member>",
    args: true,
    specialArgs: undefined,
    permLevel: permLevels.mod,
    guildOnly: true,
    moderation: true,
    async execute(client, message, args) {
        try {
            if (!message.guild) return;

            const target = await stringToMember(message.guild, args[0], false, false, false);
            if (!target || !(target instanceof Discord.GuildMember)) {
                await client.specials?.sendError(message.channel, "Not a member");
                return;
            }
            if (!target.bannable) {
                await client.specials?.sendError(message.channel, `${target} is not bannable`);
                return;
            }

            args.shift();

            let mendm = ""
            let time = 0;
            let dur = "";
            if (args[0]) {
                time = stringToDuration(args[0])
            }
            if (time) {
                dur = durationToString(time);
                mendm = ` for ${dur}`
                args.shift();
            }

            const reason = args.join(" ");
            try {
                const permsActual = await getPermLevel(target);// getting the perm level of the target, this should not play into their bannability
                target.ban({ reason: reason });
                if (permsActual >= permLevels.botMaster) {
                    message.channel.send(`<a:spinning_light00:680291499904073739>✅ Banned ${target.user.tag}\nhttps://i.imgur.com/wdmSvX6.gif`);
                } else {
                    message.channel.send(`<a:spinning_light00:680291499904073739>✅ Banned ${target.user.tag}${mendm}`);
                }

                if (time) {
                    /*setTimeout(async () => {
                        if (mutedRole) {
                            if (!toMute.roles.cache.has(mutedRole.id)) return;
                            // Remove the mentioned users role "mutedRole", "muted.json", and notify command sender
                            await toMute.roles.remove(mutedRole, `unmuting automatically after ${dur}`);
                            if (toMute.voice.connection && toMute.voice.mute) {
                                toMute.voice.setMute(false);
                            }
                        }
                    }, time)*/
                    const t = moment().add(time, "ms").toDate();
                    const data: UnbanActionData = {
                        guildid: message.guild.id,
                        userid: target.id,
                        duration: dur
                    }
                    await client.database?.setAction(message.id, t, "unban", data);
                }
            } catch (e) {
                message.channel.send(`<a:spinning_light00:680291499904073739>🆘 Could not ban ${target.user.tag}`);
            }
        } catch (error) {
            xlg.error(error);
            await client.specials?.sendError(message.channel);
            return false;
        }
    }
}

