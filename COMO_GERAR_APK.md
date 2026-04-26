# 📱 thIAguinho — Como gerar o APK Android

Guia passo-a-passo para gerar o aplicativo Android **sem instalar nada** no seu PC. Tudo é feito pelo GitHub Actions automaticamente.

---

## ✅ Pré-requisitos (uma vez só)

1. Você precisa ter conta no **GitHub** (já tem: `tsvalencio-IA`)
2. Repositório do projeto no GitHub (já tem: `tsvalencio-IA/teste`)
3. Internet pra fazer o upload e o download do APK

**Você NÃO precisa de:**
- ❌ Node.js no PC
- ❌ Android Studio
- ❌ Java/JDK
- ❌ Conhecimento de programação

---

## 🚀 Passo 1 — Subir os arquivos no GitHub

1. Vá em https://github.com/tsvalencio-IA/teste
2. Se for substituir tudo: clique em **"Add file" → "Upload files"**
3. Arraste **TODOS** os arquivos e pastas do ZIP que recebeu
   - **MUITO IMPORTANTE:** inclua a pasta oculta `.github` (no Windows, mostre arquivos ocultos antes)
   - Inclua a pasta `capacitor-android` inteira
4. Mensagem de commit (escreva): `Build APK Android com Bluetooth Clássico`
5. Clique em **Commit changes**

---

## 🤖 Passo 2 — Habilitar o GitHub Actions (uma vez só)

1. Ainda no repositório, clique em **"Settings"** (no menu superior)
2. No menu lateral, clique em **"Actions" → "General"**
3. Em "Actions permissions", marque: **✅ Allow all actions and reusable workflows**
4. Em "Workflow permissions", marque: **✅ Read and write permissions**
5. Clique em **Save**

---

## ⚙️ Passo 3 — Disparar o build do APK

**Opção A — Automático (recomendado):**
- Já dispara sozinho a cada commit que você fizer

**Opção B — Manual:**
1. Vá na aba **"Actions"** do repositório (no menu superior)
2. Clique em **"Build APK Android"** (no menu lateral)
3. Clique no botão **"Run workflow" → "Run workflow"** (verde)

O processo leva **~10-15 minutos**. Você pode fechar a aba — o GitHub continua compilando sozinho.

---

## 📥 Passo 4 — Baixar o APK

Quando o build terminar (vai aparecer ✅ verde na aba Actions):

**Opção A — Pela aba Actions:**
1. Aba **Actions** → clique no build mais recente
2. Role até embaixo da página, seção **"Artifacts"**
3. Clique em **`thIAguinho-APK`** para baixar

**Opção B — Pela aba Releases (mais fácil):**
1. Vá na aba **"Releases"** do repositório
2. Pegue a release mais recente
3. Baixe o arquivo `.apk` direto

---

## 📲 Passo 5 — Mandar pro cliente

1. Mande o `.apk` pelo WhatsApp para o cliente
2. Cliente recebe e abre no Android
3. Se aparecer **"fontes desconhecidas"**, clique em **PERMITIR**
4. Toque em **INSTALAR**
5. Pronto — ícone "thIAguinho" aparece na tela do celular

---

## 🔍 Como saber se está funcionando?

### ✅ Build deu certo se:
- Aba Actions mostra ✅ verde
- Tem APK na seção Artifacts ou Releases

### ❌ Build deu errado se:
- Aba Actions mostra ❌ vermelho
- Clique no build com erro → "Show all logs" → me mande print

---

## 🧪 Testando o ELM327 CHX

1. **Pareie o CHX no Android** primeiro (pelas configurações Bluetooth do Android, senha 6789) — uma vez só
2. Abra o app **thIAguinho**
3. Faça login como cliente
4. Vá na aba **OBD** ou **Scanner**
5. Aparece a opção "Conectar OBD (Bluetooth)"
6. Lista de dispositivos pareados aparece — escolha o **CHX**
7. Conecta e funciona

---

## ❓ FAQ

**P: O APK funciona em qualquer Android?**
R: Sim, Android 7.0 ou superior.

**P: Preciso atualizar o APK toda vez que mudar o sistema?**
R: NÃO! O APK aponta para o GitHub Pages. Você atualiza o site, o APK já está atualizado quando o cliente abrir. Só precisa rebuilder APK se mudar o plugin Bluetooth ou o ícone.

**P: Quanto custa rodar o GitHub Actions?**
R: Zero. Gratuito até 2.000 minutos/mês (~200 builds/mês). Cada build dura ~10 min.

**P: O cliente vê tudo (gestor, mecânico)?**
R: Não. O APK abre na tela inicial com **seletor de perfil**. Cada um faz login com seu próprio email/senha.

**P: O ícone tá feio (T placeholder)?**
R: Sim, é placeholder. Quando você tiver logo definitivo, me mande PNG 1024x1024 e eu substituo. Aí basta rebuilder.

---

## 🆘 Troubleshooting

### Build falhou com erro "Permission denied"
Vá em Settings → Actions → General → marque "Read and write permissions"

### Build falhou com "npm install error"
Geralmente conexão de rede. Tente Run workflow manualmente.

### APK instala mas crasha ao abrir
Abra o aplicativo no celular conectado ao PC + `adb logcat` para ver erro. Me mande o log.

### CHX não aparece na lista de pareados
Confira que: (1) Bluetooth do celular tá ligado, (2) CHX está pareado no Android antes (Configurações > Bluetooth, senha 6789), (3) você deu permissão Bluetooth ao app no primeiro uso.

---

Powered by thIAguinho Soluções Digitais
