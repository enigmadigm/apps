import { Guild, GuildMember, User } from "discord.js";
import moment from "moment";
import { InviteData, InviteStateData, XClient } from "../gm";

/**
 * This class tracks invites
 * every time a member joins or leaves, update is called which updates the state in the db
 * the old state is also compared with the new state, and the invites that have a different number of uses are considered to have been used or caused a member to leave
 */
export default class {
    public client: XClient;

    constructor(client: XClient) {
        this.client = client;
    }

    public async getFull(guild: Guild): Promise<{ invitesNow: InviteData[], invitesBefore: InviteData[], increased: InviteData[], decreased: InviteData[] } | void> {
        try {
            if (!guild.me?.permissions.has("MANAGE_GUILD")) return;
            const previousResult = await this.client.database.getGuildSetting(guild.id, "invites_data");//TODO: make this a direct method for interacting with the db table
            const stateBefore: InviteStateData = previousResult ? JSON.parse(previousResult.value) : { guildid: guild.id, invites: [] };
            const invitesBefore = stateBefore.invites;
            const invitesCollection = await guild.fetchInvites();
            const invites: InviteData[] = invitesCollection.filter(x => typeof x.uses === "number" && x.inviter instanceof User).map((x) => {
                return { inviter: x.inviter?.id || "", uses: x.uses || 0, code: x.code, channel: x.channel.id, members: x.memberCount || 0 };
            });
            const increasedInvites = invites.filter(x => {
                const preexisting = invitesBefore.find(x2 => x2.code === x.code);
                return (!preexisting || preexisting.uses < x.uses) && x.uses > 0;
            });
            const decreasedInvites = invites.filter(x => {
                const preexisting = invitesBefore.find(x2 => x2.code === x.code);
                return (preexisting && x.members < preexisting.members);
            })
            const newState: InviteStateData = { guildid: guild.id, invites };
            await this.client.database.editGuildSetting(guild, "invites_data", JSON.stringify(newState).escapeSpecialChars());// make sure the new invites state gets updated in the database
            return { invitesBefore, invitesNow: invites, increased: increasedInvites, decreased: decreasedInvites };
        } catch (error) {
            xlg.error(error);
        }
    }
    //TODO: to receive the member that has left or joined separate function(s) needed to handle exact member change
    /// OR: an argument for update() `state` boolean

    /**
     * The method to execute if a member is arriving and the difference in invite states needs to be checked for the invite that was used
     * @param member the arriving guild member
     * @returns nothing
     */
    public async logIngress(member: GuildMember): Promise<void> {
        try {
            const d = await this.getFull(member.guild);
            if (!d) return;
            const { increased } = d;
            if (!increased.length) return;
            let invite;
            if (increased.length === 1) {// if only one invite increased in uses since the invites were last tracked
                invite = increased[0];
            } else {
                const probable = increased.sort((a,b) => a.uses - b.uses);
                if (!probable.length) return;
                invite = probable[0];
            }
            const inviter = member.guild.members.cache.get(invite.inviter);
            if (!inviter) return;
            await this.client.database.addInvite(member.guild.id, member.user, invite.code, inviter.user);
            //TODO: add more features that make use of the newly invited user to do roles and stuff
        } catch (error) {
            xlg.error(error);
        }
    }

    /**
     * The function to execute if a member is leaving and invites need to be check-backed
     * @param member departing guild member
     * @returns nothing
     */
    public async logEgress(member: GuildMember): Promise<void> {
        try {
            const d = await this.getFull(member.guild);
            if (!d) return;
            const { decreased } = d;
            if (!decreased.length) return;
            let invite;
            if (decreased.length === 1) {// if only one invite increased in uses since the invites were last tracked
                invite = decreased[0];
            } else {
                const probable = decreased.filter(x => x.inviter !== member.id);
                if (!probable.length) return;
                invite = probable[0];
            }
            const userInvites = await this.client.database.getInvites({ invitee: member.id, guildid: member.guild.id });
            console.log(userInvites)
            if (!userInvites.length || !userInvites.find(x => moment().diff(x.inviteat, "s") < 300)) {// if it is determined that an invite has not already been tracked for the departing user, it adds one to the database just so it can be recorded
                const inviter = member.guild.members.cache.get(invite.inviter);
                const pastCodeInvites = await this.client.database.getInvites({ guildid: member.guild.id, code: invite.code });
                await this.client.database.addInvite(member.id, member.user, invite.code, inviter?.user ?? { id: invite.inviter, tag: pastCodeInvites.length ? pastCodeInvites[0].invitername : "" });
            }
            //TODO: here the invite entry in the db could be updated to reflect the departure of the user
        } catch (error) {
            xlg.error(error);
        }
    }
}
