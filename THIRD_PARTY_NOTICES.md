# Avisos de terceiros

A licença MIT deste repositório cobre o código original identificado em [LICENSE](LICENSE). Dependências npm, fontes, imagens, ícones, bibliotecas nativas e serviços externos mantêm seus próprios titulares, avisos e condições de licença; não são relicenciados por este arquivo.

O inventário do lockfile pode ser gerado após instalar as dependências:

```bash
npm ci
npm run legal:inventory
```

O inventário gerado descreve componentes instalados para desenvolvimento e build; **não é uma atestação da composição exata** de um bundle, container ou instalador. Antes de redistribuir um artefato compilado, revise os arquivos de licença que ele contém, as dependências nativas e as condições dos assets/fontes incluídos.

A aplicação carrega fontes hospedadas por Google Fonts no navegador. Se sua implantação precisar funcionar sem acesso externo ou redistribuir fontes localmente, selecione fontes com licenças adequadas e atualize a referência em `frontend/index.html`.
