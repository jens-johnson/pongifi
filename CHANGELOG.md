# Changelog

## [0.3.0](https://github.com/jens-johnson/pongifi/compare/pongifi-v0.2.0...pongifi-v0.3.0) (2026-09-10)


### ✨ Features

* add a mobile navigation menu ([e579f02](https://github.com/jens-johnson/pongifi/commit/e579f02fdb8b1afa41b0068425ca8dee61655bee))
* add the profile, welcome and dashboard pages ([e58546f](https://github.com/jens-johnson/pongifi/commit/e58546f05b57edcef4ed28242f35f0f6fb4b5851))
* **api:** add the account and league endpoints the profile pages read ([af14db9](https://github.com/jens-johnson/pongifi/commit/af14db94af7847652d731601904f4eb59279486f))
* **api:** close the private-read and write gaps on the profile endpoints ([545c5e1](https://github.com/jens-johnson/pongifi/commit/545c5e13a3db7b457572ac71514089eb6135da12))
* **app:** route every request according to the session behind it ([d99fe7b](https://github.com/jens-johnson/pongifi/commit/d99fe7be7a89ff860c395a6b88ebecd318235ad1))
* **auth:** add google sign-in flow ([a7d03f6](https://github.com/jens-johnson/pongifi/commit/a7d03f6504af61b3b6dcaf4bfad026df1e993d5b))
* **auth:** add Google sign-in flow ([09e382f](https://github.com/jens-johnson/pongifi/commit/09e382f2b648fbf0fe30c8edc1f6cab28b8910ce))
* **auth:** record when a player has completed the welcome step ([383d908](https://github.com/jens-johnson/pongifi/commit/383d90801de7cb4c39740eccbd83271210f4dae2))
* build the about page ([4a64cc1](https://github.com/jens-johnson/pongifi/commit/4a64cc11d1a36038e7ada832cff92f6514b5a756))
* build the features page ([8155102](https://github.com/jens-johnson/pongifi/commit/81551022102e97abc3b4c50221d0b7c76dd9dacb))
* **components:** build the account, leagues and dashboard components ([cb9ec43](https://github.com/jens-johnson/pongifi/commit/cb9ec433faf24376a511c3fa20a42122b1d18ae4))
* **components:** turn the launch-scope strip into a coming-soon section ([c314e1d](https://github.com/jens-johnson/pongifi/commit/c314e1db6396a54207746ebb6a890401118efe53))
* dithered hero backdrop and the design token sync ([c93772b](https://github.com/jens-johnson/pongifi/commit/c93772bbf1426336602795f3b6489a9cba882f6a))
* give the marketing pages routes and fill the space below the hero ([984d425](https://github.com/jens-johnson/pongifi/commit/984d425693fbccf0cbf389ba9bec9db89e1b9384))
* lean the landing page on the accent and rotate the headline ([ac4454f](https://github.com/jens-johnson/pongifi/commit/ac4454fd513db5701b7d13b01487e5247d1ca810))
* marketing site scaffold, features page, and style-guide alignment ([7d76db6](https://github.com/jens-johnson/pongifi/commit/7d76db6685d91478b5fe6f00810329e19bd0f903))
* **pages:** add the profile, welcome and leagues pages and the signed-in shell ([e0c426a](https://github.com/jens-johnson/pongifi/commit/e0c426a26ee97b0a3d783c39875e88cff9131253))
* **pages:** build the faq page ([bd4899b](https://github.com/jens-johnson/pongifi/commit/bd4899b04b812ec78026a48535bbad84f4040374))
* **pages:** build the faq page ([515202d](https://github.com/jens-johnson/pongifi/commit/515202d4f86242dc4c7699087697fbbb203e8a4f))


### 🐛 Bug Fixes

* **app:** close the sign-in loop an unauthorized read left open ([e6f60f8](https://github.com/jens-johnson/pongifi/commit/e6f60f8c7cb38bfd1b0d8e27371532fe07ce70ec))
* **auth:** address sign-in review comments ([812d062](https://github.com/jens-johnson/pongifi/commit/812d06276c7959fee4ab2efffa22ac1c9cc27587))
* **auth:** keep a player's chosen display name across google sign-ins ([863fb28](https://github.com/jens-johnson/pongifi/commit/863fb2828cd9d8f4b1b321008520a7cf07a9c1cc))
* **auth:** make the session user type visible to server code ([95abcd1](https://github.com/jens-johnson/pongifi/commit/95abcd1b16c6f9c90f434039780e1d5c8f56c523))
* **ci:** apply database migrations during the vercel build ([1d27815](https://github.com/jens-johnson/pongifi/commit/1d27815e1a1ddd00e43ebc486cdd2bbd9e059ea0))
* **ci:** apply database migrations during the vercel build ([e47ad93](https://github.com/jens-johnson/pongifi/commit/e47ad93ff1ca161780ad5d1caa1e3c7a00330b9a))
* **ci:** guard cleanup state and trusted loader ([dbcede0](https://github.com/jens-johnson/pongifi/commit/dbcede04783217d55a8ad298a8803f9820cebb54))
* **components:** centre the trust stepper circles above their labels ([31ee83b](https://github.com/jens-johnson/pongifi/commit/31ee83b12840a1b0e4a9caf7334715b887d80905))
* give the accent tokens enough contrast for use on buttons and links ([f379ee8](https://github.com/jens-johnson/pongifi/commit/f379ee8928d02550e76e1cbf8e5516590fc8eb40))
* **pages:** preserve faq navigation state ([583868a](https://github.com/jens-johnson/pongifi/commit/583868adf654f98bd818d6839848a19546029a80))
* **pages:** refresh the session after a write and draw the failed read ([0ceef54](https://github.com/jens-johnson/pongifi/commit/0ceef5473f4f5ac4a8c1f3a6d9f532365bf843e6))
* **pages:** remove regulation table question ([2b60e2f](https://github.com/jens-johnson/pongifi/commit/2b60e2fa84dd4780d8692173dde6d36a17dceeca))
* **pages:** route faq fragments through vue router ([07166a3](https://github.com/jens-johnson/pongifi/commit/07166a39430dcc30df360af261eaec6186353cc7))
* **pages:** set the dashboard's cache header through the nuxt composable ([7932011](https://github.com/jens-johnson/pongifi/commit/79320115c1afc9d0d7931d670e0a4a031f054f64))
* **server:** refuse a write the rate limiter did not answer in time ([3ff0271](https://github.com/jens-johnson/pongifi/commit/3ff0271f105e189fcef8037f8d6b10443a2623f6))


### ♻️  Refactors

* **app:** align the remaining scaffold with the style guide ([1203e14](https://github.com/jens-johnson/pongifi/commit/1203e148c22002e4a958c2d0bb4d0525451c7eff))
* **components:** bring the features components up to the style guide ([c37fa11](https://github.com/jens-johnson/pongifi/commit/c37fa1117b3e50a4d42d8f37fd185540e566c035))
* move components into atomic-design folders ([e01d0a4](https://github.com/jens-johnson/pongifi/commit/e01d0a4efdaec65bcbfa8a645f8909f908640724))


### 👷 CI

* **db:** retire closed pull request databases ([be6bbf9](https://github.com/jens-johnson/pongifi/commit/be6bbf954933024ca5e8f72370b050a4f8492282))
* **db:** retire closed pull request databases ([fc73cf7](https://github.com/jens-johnson/pongifi/commit/fc73cf71e0110453abd2c12df6b811d16d844bd3))

## [0.2.0](https://github.com/jens-johnson/pongifi/compare/pongifi-v0.1.0...pongifi-v0.2.0) (2026-08-28)


### ✨ Features

* **config:** scaffold the nuxt 4 application and shared tooling ([45dd1a3](https://github.com/jens-johnson/pongifi/commit/45dd1a37d66c4dfc38576c3a3464cfb240d75218))
* **db:** model the schema and check in the first migration ([d894816](https://github.com/jens-johnson/pongifi/commit/d8948161aca999732a0787ae0b3b641ce74f64be))
* **db:** model the schema and check in the first migration ([5c993c2](https://github.com/jens-johnson/pongifi/commit/5c993c2308f8d2b2c690037f4ff8755ccb2430c6))
* **ratings:** add the pure elo rating engine ([ca8b994](https://github.com/jens-johnson/pongifi/commit/ca8b994890afba2f0fac76b3da3f143b7707c872))
* **ratings:** add the pure elo rating engine ([7ad7fd4](https://github.com/jens-johnson/pongifi/commit/7ad7fd43e2c76f13c4752fa1b63c2b1b193b654d))
* **rules:** add the pure match-state rules engine ([00f4625](https://github.com/jens-johnson/pongifi/commit/00f4625dd931cdf6ca92a24280b79805c7168216))
* **rules:** add the pure match-state rules engine ([07c3f04](https://github.com/jens-johnson/pongifi/commit/07c3f046a1aea8543fe2fc83059a1e6b80f8b6fd))


### 🐛 Bug Fixes

* **config:** map the env var names the marketplace integrations create ([33d4c98](https://github.com/jens-johnson/pongifi/commit/33d4c984fbc4647974afa3d97a2439df0c7c76b9))
* **config:** pin the type roots for the tooling project ([ca9f7be](https://github.com/jens-johnson/pongifi/commit/ca9f7bedf6219e6940686ef1f8e65037e5828fee))
* **config:** print the pongifi banner in the shell init ([f82c0d8](https://github.com/jens-johnson/pongifi/commit/f82c0d8c09871757a521994b2ea078bb88a17182))
* **config:** put the root config files under the compiler ([dc08e24](https://github.com/jens-johnson/pongifi/commit/dc08e245424290f03540ed398784a0f43c0f8440))
* **config:** use the valid nuxtjs framework slug in vercel config ([e0eb429](https://github.com/jens-johnson/pongifi/commit/e0eb429df0d21d7df417add73f17a25dae0158cb))


### ♻️  Refactors

* **config:** normalize header widths and apply the comment conventions ([890403d](https://github.com/jens-johnson/pongifi/commit/890403d3857bca8fd651fee68cf1d723a8e2ac40))
* **config:** normalize header widths and apply the comment conventions ([01093b6](https://github.com/jens-johnson/pongifi/commit/01093b6936786546444e3521f1efca2f9a6a0e62))
* **db:** drop the enum prefix and sort declarations ([008fff4](https://github.com/jens-johnson/pongifi/commit/008fff4ea881dc7c191db55befed0a318fb604d4))
* **ratings:** apply the typing, comment, and iteration conventions ([7fda1c7](https://github.com/jens-johnson/pongifi/commit/7fda1c7eb6c1577af9589f57be2499993a2b9eae))
* **ratings:** drop the enum prefix and sort declarations ([2fdbac4](https://github.com/jens-johnson/pongifi/commit/2fdbac46dc405f88a6c25b717e9f8b2ff4d6266f))
* **rules:** drop the enum prefix and sort declarations ([34a85bc](https://github.com/jens-johnson/pongifi/commit/34a85bcc5d129a0d9ef038daace1c326860aa7f4))


### 📝 Docs

* **config:** pull vercel env into the file nuxt actually reads ([a19c0e7](https://github.com/jens-johnson/pongifi/commit/a19c0e78278b38cd8ba5f0e24a1a11019823a18e))
* split the public readme from the developer documentation ([d2627ab](https://github.com/jens-johnson/pongifi/commit/d2627ab3488c6b4a44cab50f1f5b73ccc2921801))
* trim trailing whitespace from the prose ([f827fe2](https://github.com/jens-johnson/pongifi/commit/f827fe2296559bdd2be99bf38a00c182b06e252b))


### 👷 CI

* stop prettier failing every release pull request ([c534756](https://github.com/jens-johnson/pongifi/commit/c534756ce0af900bba6ca5499917300138fc6b9b))
* stop prettier failing every release pull request ([1814a6d](https://github.com/jens-johnson/pongifi/commit/1814a6d07f351d4f5ccb228c6a2b5f707284db49))
