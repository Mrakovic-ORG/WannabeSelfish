require('colors');
const fs = require('fs'),
    Discord = require('discord.js'),
    bot = new Discord.Client(),
    prompts = require('prompts'),
    CryptoJS = require('crypto-js'),
    fetch = require('node-fetch');

let config = '',
    configPrefix = '',
    configToken = '';

process.title = 'WannabeSelfish - WANNABE1337.xyz';

/**
 * Try to access config file
 * if available proceed to login
 * else register config file
 */
fs.promises.access('./config.json', fs.constants.F_OK)
    .then(() => login())
    .catch(() => register());

// Display exit selection if process detects exit attempt.
process.on('SIGINT', () => exitSelect());

bot.on('message', (message) => {
    if (message.author.id !== bot.user.id) return;
    if (!message.content.startsWith(config.prefix)) return;

    let msg = message.content,
        msgArg = msg.slice(configPrefix.length).split(/ +/),
        msgCommand = msgArg.shift().toLowerCase(),
        msgWithoutCommandName = msg.slice((configPrefix + msgCommand + 1).length),
        msgWithoutCmd = msgArg[0] ? msgWithoutCommandName.slice(msgArg[0].length) : '';

    /**
     * List command with their usage
     */
    if (msgCommand === 'help') {
        message.delete().then(() => displayCommands());
    }

    /**
     * Add alphabetical reactions to the replied message
     * <Alphabetical Reaction>
     */
    if (msgCommand === 'react') {
        message.delete();

        const messageRef = message.reference?.messageID ?? false,
            reaction = new Set(String(msgArg[0]).split('')),
            CODE_POINT = 127365;

        if (messageRef === false) return console.log('You must use this command inside a reply'.red)
        if (reaction.size > 20) return console.log('Cannot add more than 20 reactions per message'.red)

        message.channel.fetchMessage(messageRef).then(message => {
            reaction.forEach(char => {
                // get char code point add the distant CODE_POINT to get its Regional indicator symbol
                message.react(String.fromCodePoint(char.toLocaleLowerCase().codePointAt(0) + CODE_POINT))
                    .then(r => console.log(`Reacting to %s in %s`.cyan, `${r.message.author.username}#${r.message.author.discriminator}`.bold, `${r.message.channel.name}`.bold))
                    .catch(() => console.log(`Could not react with %s`.red, `${char}`.bold));
            });
        });
    }

    /**
     * Add alphabetical reactions to a number of message
     * <Number Of Message> <Alphabetical Reaction>
     */
    if (msgCommand === 'bulk_react' || msgCommand === 'br') {
        message.delete();

        const numberMsg = parseInt(msgArg[0], 10),
            reaction = new Set(String(msgArg[1]).split('')),
            CODE_POINT = 127365;

        if (isNaN(numberMsg)) return console.log('Invalid Integer?'.red);
        if (reaction.size > 20) return console.log('Cannot add more than 20 reactions per message'.red);

        massFetchMessages(message.channel).then(messages => {
            let msg_array = messages.filter(m => m.author.id !== bot.user.id).slice(0, numberMsg);

            msg_array.map(msg => {
                reaction.forEach(char => {
                    // get char code point add the distant CODE_POINT to get its Regional indicator symbol
                    msg.react(String.fromCodePoint(char.toLocaleLowerCase().codePointAt(0) + CODE_POINT))
                        .then(r => console.log(`Reacting to %s in %s`.cyan, `${r.message.author.username}#${r.message.author.discriminator}`.bold, `${r.message.channel.name}`.bold))
                        .catch(() => console.log(`Could not react with %s`.red, `${char}`.bold));
                });
            });
        });
    }

    /**
     * Remove all reactions that were set to a number of message
     * <Number Of Message>
     */
    if (msgCommand === 'purge_reactions' || msgCommand === 'pr') {
        message.delete();

        const numberMsg = parseInt(msgArg[0], 10);

        if (isNaN(numberMsg)) return console.log('Invalid Integer?'.red);

        massFetchMessages(message.channel).then(messages => {
            let msg_array = messages.filter(m => m.author.id !== bot.user.id).slice(0, numberMsg);

            msg_array.map(msg => {
                msg.reactions.forEach(reaction => {
                    reaction.me && reaction.remove()
                        .then(() => console.log(`Removing reaction "%s" to %s in %s`.cyan, `${reaction.emoji.name}`.bold, `${reaction.message.author.username}#${reaction.message.author.discriminator}`.bold, `${reaction.message.channel.name}`.bold))
                        .catch((reactions) => console.log(`Could not clear reaction %s`.red, `${reactions}`.bold));
                });
            });
        });
    }

    /**
     * Guild Mass message send
     * <Message>
     */
    if (msgCommand === 'guild_message') {
        message.delete();
        let dmGuild = message.guild;
        if (!msgWithoutCommandName || msgWithoutCommandName.length <= 0) return;

        dmGuild.members.forEach(member => {
            if (member.id === bot.user.id) return;
            console.log(`Trying to message %s`.cyan, `${member.user.username}#${member.user.discriminator}`.bold);
            member.send(msgWithoutCommandName).catch(() => console.log(`Could not message %s`.red, `${member.user.username}#${member.user.discriminator}`.bold));
        });
    }

    /**
     * Send a message to all the users you had a talk/interaction with
     * <Message>
     */
    if (msgCommand === 'message_all') {
        message.delete();
        if (!msgWithoutCommandName || msgWithoutCommandName.length <= 0) return;

        bot.user.client.users.forEach(member => {
            console.log(`Trying to message %s`.cyan, `${member.username}#${member.discriminator}`.bold);
            bot.users.get(member.id).send(msgWithoutCommandName).catch(() => console.log(`Could not message %s`.red, `${member.username}#${member.discriminator}`.bold));
        });
    }

    /**
     * Purge messages
     * <Number Of Message>
     */
    if (msgCommand === 'purge' || msgCommand === 'prune') {
        let numberMsg = parseInt(msgArg[0], 10);
        if (isNaN(numberMsg)) return console.log('Invalid Integer?'.red);

        massFetchMessages(message.channel).then(messages => {
            let msg_array = messages.filter(m => m.author.id === bot.user.id).slice(0, numberMsg),
                totalMsg = msg_array.length,
                delMsg = '';

            if (totalMsg <= 0) return console.log('No message to delete.'.red);

            if (message.channel.type === 'dm') {
                delMsg = `${message.channel.recipient.username}#${message.channel.recipient.discriminator}`;
            } else if (message.channel.type === 'group') {
                delMsg = `a Group`;
            } else {
                delMsg = `${message.channel.guild.name} -> ${message.channel.name}`;
            }

            console.log(`Deleting %s messages in %s.`.cyan, totalMsg.toString().bold, delMsg.bold);

            msg_array.filter(m => !m.system).map(m => m.delete()
                .then(() => console.log(`Deleted %s in %s.`.cyan, m.content.bold, delMsg.bold))
                .catch(() => console.log(`Could not delete %s in %s.`.red, m.content.bold, delMsg.bold)));
        }).catch(() => console.log(`Could not load messages.`.red));
    }

    /**
     * Purge messages from all pm sent
     */
    if (msgCommand === 'purge_all' || msgCommand === 'prune_all') {
        bot.user.client.users.forEach(member => {
            if (!bot.users.get(member.id).dmChannel) return;

            massFetchMessages(bot.users.get(member.id).dmChannel).then(messages => {
                let msg_array = messages.filter(m => m.author.id === bot.user.id),
                    totalMsg = msg_array.length,
                    delMsg = `${member.username}#${member.discriminator}`;

                if (totalMsg <= 0) return;

                console.log(`Deleting %s messages from %s`.cyan, totalMsg.toString().bold, `${member.username}#${member.discriminator}`.bold);

                msg_array.filter(m => !m.system).map(m => m.delete()
                    .then(() => console.log(`Deleted %s in %s.`.cyan, m.content.bold, delMsg.bold))
                    .catch(() => console.log(`Could not delete %s in %s.`.red, m.content.bold, delMsg.bold)));
            }).catch(() => console.log(`Could not load messages from %s`.red, `${member.username}#${member.discriminator}`.bold));
        });

    }

    /**
     * Send the number of message you wrote on the channel
     */
    if (msgCommand === 'cm' || msgCommand === 'count_messages') {
        message.delete();

        massFetchMessages(message.channel).then(messages => {
            let msg_array = messages.filter(m => m.author.id === bot.user.id),
                totalMsg = msg_array.length;

            message.channel.send(`I wrote ${totalMsg} messages in this channel.`).catch(() => console.log(`Could not send the message.`.red));
        }).catch(() => console.log(`Could not load messages.`.red));
    }

    /**
     * Spam messages
     * <Number Of Message> <Messages>
     */
    if (msgCommand === 'sp' || msgCommand === 'spam') {
        message.delete();

        for (let i = 0, iN = Number(msgArg[0]); i < iN; ++i) {
            message.channel.send(msgWithoutCmd).catch(() => console.log(`Could not send the %s message.`.cyan.bgRed, i.toString().bold));

            if (i >= iN - 1) {
                console.log('Successfully sent %s messages.'.cyan, iN.toString().bold);
            }
        }
    }

    /**
     * Logger Fucker by Edition
     * <Repetition> <Message>
     */
    if (msgCommand === 'lfe') {
        for (let i = 0; i < Number(msgArg[0]); ++i) {
            let longNl = '\n'.repeat(Math.floor(Math.random() * 1500));
            if (i % 2) {
                message.edit(msgWithoutCmd);
            }
            message.edit(msgWithoutCmd + longNl + msgWithoutCmd);
        }

        // Edit back to original
        message.delete();
    }

    /**
     * Logger Fucker by Deletion
     * <Number of Deletion> <Message>
     */
    if (msgCommand === 'lfd') {
        message.delete();

        for (let i = 0; i < Number(msgArg[0]); ++i) {
            message.channel.send(msgWithoutCmd).then(msg => msg.delete());
        }

        // Edit back to original
        message.edit(msgWithoutCmd);
    }

    /**
     * Backup friends, guilds
     */
    if (msgCommand === 'backup_account') {
        const friends = bot.user.friends.array(),
            guilds = bot.guilds.array();

        try {
            fs.writeFileSync('backup.json', JSON.stringify({
                friends: friends,
                guilds: guilds,
            }));
            console.log(`Successfully backed up ${friends.length.toString().bold} friends and ${guilds.length.toString().bold} servers.`.cyan);
        } catch {
            console.log('Could not complete the backup.'.red);
        }
    }

    /**
     * Restore friends from your backup
     */
    if (msgCommand === 'restore_friends') {
        if (fs.existsSync('backup.json') === false) {
            return console.log('Could not locate your backup.'.red);
        }

        const friends = fs.readFileSync('backup.json', 'utf-8');
        let jsonFriends = JSON.parse(friends);

        console.log(`A total of ${jsonFriends.friends.length.toString().bold} friends will be restored.`.cyan);

        jsonFriends.friends.forEach(friend => {
            fetch(`https://discord.com/api/v6/users/@me/relationships/${friend.id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': configToken,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({}),
            }).then((response) => {
                let response_data = response.clone();

                if (response_data.status === 204) {
                    console.log('Sent a friend request to %s'.cyan, (friend.username + friend.discriminator).bold);
                } else {
                    console.log('Could not send a friend request to %s'.red, (friend.username + friend.discriminator).bold);
                }
            }).catch((error) => {
                console.warn(error);
            });
        });
    }

    if (message.channel.type === 'dm') {
        //DM
    }
});

/**
 * Bypass the discord limit of fetching messages from a channel
 * @param channel
 * @param limit
 * @returns {Promise<[]>}
 */
async function massFetchMessages(channel, limit = 1000) {
    const sum_messages = [];
    let last_id;

    while (true) {
        const options = {limit: 100};
        if (last_id) {
            options.before = last_id;
        }

        const messages = await channel.fetchMessages(options);
        sum_messages.push(...messages.array());
        last_id = messages.last().id;

        if (messages.size !== 100 || sum_messages >= limit) {
            break;
        }
    }

    return sum_messages;
}

const successLogin = () => console.log(`Logged in as %s`.cyan, bot.user.tag.bold),

    welcomeMessage = () => {
        console.clear();
        console.log(`%s
%s`, ` ________                           __           _______         __   ___ __         __    
|  |  |  |.---.-.-----.-----.---.-.|  |--.-----.|     __|.-----.|  |.'  _|__|.-----.|  |--.
|  |  |  ||  _  |     |     |  _  ||  _  |  -__||__     ||  -__||  ||   _|  ||__ --||     |
|________||___._|__|__|__|__|___._||_____|_____||_______||_____||__||__| |__||_____||__|__|`.rainbow, 'by WANNABE1337.xyz\r\n'.red);
    },

    displayCommands = () => console.log(`
Welcome to the command help center.

Command Prefix => ${configPrefix.bold}

${configPrefix}${'help'.bold} => Self describing.
${configPrefix}${'react'.bold} {${'Alphabetical Message'.bold}} => Add alphabetical reactions to its replied message.
${configPrefix}[${'br'.bold}, ${'bulk_react'.bold}] {${'Number of Message'.bold}} {${'Alphabetical Message'.bold}} => Add alphabetical reactions to a number of message.
${configPrefix}[${'pr'.bold}, ${'purge_reactions'.bold}] {${'Number of Message'.bold}} => Remove reactions to a number of message.
${configPrefix}${'guild_message'.bold} => Attempt to send a message to every member from a guild/group.
${configPrefix}${'message_all'.bold} => Send a message to all the users you had a talk/interaction with.
${configPrefix}[${'purge'.bold}, ${'prune'.bold}] {${'Number of Message'.bold}} => Self describing.
${configPrefix}[${'purge_all'.bold}, ${'prune_all'.bold}] => Delete every message you sent in all private conversation you had.
${configPrefix}[${'cm'.bold}, ${'count_messages'.bold}] => Count then send the number of message you wrote on a channel.
${configPrefix}[${'sp'.bold}, ${'spam'.bold}] {${'Number of Message'.bold}} {${'Message'.bold}} => Self describing.
${configPrefix}${'lfe'.bold} {${'Repetition'.bold}} {${'Message'.bold}} => Logger Fucker by edition, Will edit a message many times in order to spam logger plugins.
${configPrefix}${'lfd'.bold} {${'Repetition'.bold}} {${'Message'.bold}} => Logger Fucker by deletion, Will send then delete many message in order to spam logger plugins.
${configPrefix}${'backup_account'.bold} => Will backup your friends and the servers you are in.
${configPrefix}${'restore_friends'.bold} => Will send a friend request to all friends who got backed up previously.\r\n`.cyan
    ),

    exitSelect = () => prompts({
        type: 'select',
        name: 'choice',
        message: 'Before you exit select your action',
        choices: [
            {
                title: 'Exit',
                description: 'Exit the current process',
                value: 1
            },
            {
                title: 'Display Commands',
                description: 'Display the list of the commands that you can use',
                value: 2
            },
            {
                title: 'Delete Config',
                description: 'Deleting the config.json file will result in loss of your token and command prefix',
                value: 3
            },
        ],
        initial: 0
    }).then(response => {
        switch (response.choice) {
            case 1:
                welcomeMessage();
                console.log('Goodbye, hope you had a nice time using %s.'.cyan, 'WannabeSelfish'.rainbow.bold);
                return process.exit();
            case 2:
                welcomeMessage();
                displayCommands();
                // Try to login if the token is already saved else ask for registration
                return bot.login(configToken).catch(e => register(false));
            case 3:
                console.log('Deleting your config...'.cyan);
                fs.unlinkSync('./config.json');
                return register(false);
        }
    }),

    login = (showWelcome = true) => {
        showWelcome === true && welcomeMessage();
        config = require('./config.json');
        configPrefix = config.prefix;

        prompts({
            type: 'password',
            name: 'pass',
            message: 'Encryption Password:',
            validate: async pass => { // Async is required to ask discord login to await
                let showError = false;

                const decryptedToken = CryptoJS.AES.decrypt(config.token, pass).toString(CryptoJS.enc.Utf8);
                await bot.login(decryptedToken).catch(e => showError = e.message);

                // if is a string it should return the error message to the prompt
                if (showError !== false) return showError;

                // if valid set bot token and return true (should return valid on the prompt)
                configToken = decryptedToken;
                return true;
            }
        }).then(response => {
            if (Object.entries(response).length === 0) return exitSelect();
            successLogin();
        });
    },

    register = (showWelcome = true) => {
        if (fs.existsSync('./config.json')) return login(false);
        showWelcome === true && welcomeMessage();
        console.log('Registering config file...'.cyan);

        prompts([
            {
                type: 'text',
                name: 'prefix',
                message: 'Command Prefix:',
            },
            {
                type: 'password',
                name: 'pass',
                message: 'Encryption Password:',
            },
            {
                type: 'password',
                name: 'token',
                message: 'Discord Token:',
            },
        ]).then(response => {
            if (Object.entries(response).length === 0) return;

            const encryptedToken = CryptoJS.AES.encrypt(response.token, response.pass).toString();
            fs.writeFileSync('./config.json', JSON.stringify({prefix: response.prefix, token: encryptedToken}));
            console.log(`Successfully registered your config, Logging in...`.green);

            // Attempt to login with the provided token
            bot.login(response.token).then(() => {
                config = require('./config.json');
                configPrefix = response.prefix;
                configToken = response.token;
                successLogin();
            }).catch(e => {
                console.log(e.message.red, 'Because the login was not successful we are re-trying to register...\n'.cyan);

                fs.unlinkSync('./config.json');
                register(false);
            });
        });
    };