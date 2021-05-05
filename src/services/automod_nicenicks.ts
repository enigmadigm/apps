import xlg from "../xlogger";
import { MessageService } from "../gm";
import { Bot } from "../bot";
import { GuildMember } from "discord.js";

export const service: MessageService = {
    async getInformation() {
        return "This will check the nicknames of new members and members who change their nicknames for cancerous characters. Basically, if there is are any non-standard english characters (alphabetic characters not found on a QWERTY keyboard) in the nickname, it will be changed to a placeholder nickname.";
    },
    async execute(client, member: GuildMember) {
        try {
            if (!member.guild) return;
            const modResult = await Bot.client.database.getAutoModuleEnabled(member.guild.id, "nicenicks", undefined, undefined, member);
            if (!modResult) return;
            
            let flag = false;
            const name = member.nickname || member.user.tag;
            const hits = /[^\x20-\x7E\n]/g.exec(name);
            if (hits && hits.index < 5) {
                flag = true;
                await member.setNickname("change name (stratum automod)", `automod:nicenicks saw a nondesirable nickname`);

                if (modResult.sendDM) {
                    await member.user.send(`Automod noticed that your nickname isn't very nice to type out. The admins of ${member.guild.name} have requested that I correct all user's undesirable nicknames to something better until they change it to something nicer; please do so!`);
                    // THIS DM MESSAGE SHOULD BE CONFIGURABLE, IT SHOULD AT LEAST BE SOMETHING THAT CAN BE TOGGLED BY ADMINS ON THE DASHBOARD
                }
            }

            if (flag) {
                await client.services?.punish<GuildMember>(modResult, member);
            }
        } catch (error) {
            xlg.error(error);
        }
    }
}