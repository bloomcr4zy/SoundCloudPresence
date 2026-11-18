![SoundCloudPresence — Rich Presence for Discord](assets/banner.png)

# SoundCloudPresence

[English](README.en.md)

Mostre no Discord a faixa que você está ouvindo no SoundCloud. O plugin exibe título e artista e, quando encontra uma correspondência na busca pública do SoundCloud, adiciona a capa e o botão **Listen on SoundCloud**.

## Requisitos

- Windows ou macOS, Discord para desktop com [BetterDiscord](https://betterdiscord.app/) e [Node.js](https://nodejs.org/) 22 ou posterior.
- Uma conta no Last.fm, uma [chave da API do Last.fm](https://www.last.fm/api/account/create) e a extensão [Web Scrobbler](https://webscrobbler.com/).
- Um [Application ID do Discord](https://discord.com/developers/applications) para identificar a atividade.

## Instalação

1. No navegador, abra o Web Scrobbler e autorize sua conta do Last.fm. Toque uma faixa no SoundCloud e confirme que ela aparece como reprodução atual no seu perfil do Last.fm.
2. Baixe o repositório. No Discord, vá em **Settings → BetterDiscord → Plugins → Open Plugin Folder** e copie [SoundCloudPresence.plugin.js](SoundCloudPresence.plugin.js) para essa pasta.
3. No [Discord Developer Portal](https://discord.com/developers/applications), crie uma aplicação e copie o **Application ID** em **General Information**. O nome da aplicação aparece no cabeçalho da atividade. Se quiser o ícone pequeno do SoundCloud, adicione um recurso chamado `soundcloud` em **Rich Presence → Art Assets**.
4. Abra o PowerShell (Windows) ou o Terminal (macOS) na pasta baixada e execute o comando abaixo, substituindo `SEU_APPLICATION_ID` pelo ID copiado. Mantenha o terminal aberto enquanto usar o plugin.

   ```text
   node bridge.cjs SEU_APPLICATION_ID
   ```

5. Ative **SoundCloudPresence** no BetterDiscord. Na engrenagem, informe seu usuário e sua chave de API do Last.fm e clique em **Save settings**. Se necessário, habilite o compartilhamento em **Settings → Activity Privacy**.

Se preferir abrir a pasta do plugin diretamente, use `%APPDATA%\BetterDiscord\plugins` no Windows ou `~/Library/Application Support/BetterDiscord/plugins` no macOS.

O **Application ID** é público e pode ser compartilhado entre instalações da mesma aplicação. O ícone pequeno também pode ser configurado uma única vez pelo dono dessa aplicação e aparece para as instalações que usam seu ID.

## Como funciona

O Web Scrobbler envia a reprodução do navegador ao Last.fm. O plugin consulta o Last.fm a cada cinco segundos entre verificações e usa a busca pública do SoundCloud para obter capa e link. A ponte repassa o resultado via Rich Presence ao Discord desktop. A busca pública dispensa token do SoundCloud, e a ponte só precisa do Application ID do Discord.

Se a faixa aparecer sem capa, o SoundCloud pode estar sem imagem para aquele upload ou a busca pode ter retornado resultados ambíguos. A conta do Last.fm também pode receber faixas de outros serviços conectados.

## Licença

[MIT](LICENSE)
