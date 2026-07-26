# Campo Harmônico & Modos Gregos

Site que mostra, para qualquer nota escolhida, o campo harmônico
(maior e menor) em tabela e os shapes dos modos gregos no braço do violão.

## Rodar localmente

```
npm install
npm run dev
```

## Publicar no GitHub Pages

Veja o passo a passo completo na conversa com o Claude que gerou este projeto.
Resumo:

1. Crie um repositório público no GitHub.
2. Edite `vite.config.js` e coloque o nome exato do repositório em `base`.
3. `git init && git add . && git commit -m "primeira versão"`
4. `git branch -M main`
5. `git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git`
6. `git push -u origin main`
7. No GitHub: Settings → Pages → Source → **GitHub Actions**.
8. Aguarde a aba **Actions** terminar o deploy. O site fica em:
   `https://SEU_USUARIO.github.io/SEU_REPO/`
