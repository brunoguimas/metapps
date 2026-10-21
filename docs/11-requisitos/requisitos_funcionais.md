# Requisitos funcionais

## Cadastro e login

### RF01 - Cadastro

> [✓] O sistema deve permitir que os usuários se cadastrem utilizando nome de usuário, email e senha.

### RF02 - Login

> [✓] O Sistema deve permitir que o usuário realize login utilizando email e senha.

### RF03 - Alteração de senha

> [✗] O sistema deve permitir que o usuario mude sua senha enviando sua senha antiga.

### RF04 - Recuperação de senha

> [✓] O sistema deve permitir que o usuario recupere sua senha utilizando um token especial enviado em seu email.

## Gerenciamento de metas

### RF05 - Criação de meta

> [⚠️] O sistema deve permitir que o usuario defina uma meta por meio de um questionário curto contendo:
> - "Nome da meta" (ex: Redação ENEM, Interpretação de texto etc.);
> - "Motivação";
> - "[✗] Maiores dificuldades" (ex: Gramática, Equações).

### RF06 - Múltiplas metas

> [✓] O sistema deve permitir que o usuario possua mais de uma meta.

### RF07 - Atividades diárias

> [✓] O sistema deve disponibilizar atividades diárias para o usuario que se moldam a necessidade do mesmo:
> - Essas atividades podem ser: quiz, produção textual, exercício de alternativa simples entre outros;
> - Essas atividades devem acompanhar o nível de aprendizado do usuario, assim mudando a dificuldade conforme o necessário.

### RF07.1 - Sessão passo a passo

> [✓] O sistema deve apresentar a atividade como uma sequência de pelo menos 3 exercícios curtos, um por vez, com feedback instantâneo a cada resposta.
> - O feedback (certo/errado, explicação, XP) deve ser calculado no servidor;
> - Responder o mesmo exercício de novo não pode conceder XP duas vezes.

### RF07.2 - Meta diária e constância

> [✓] O sistema deve manter uma meta diária de XP configurável e mostrar o progresso do dia e a sequência de dias de estudo (streak).

### RF07.3 - Treino e revisão

> [✓] O sistema deve oferecer:
> - **Treino**: sessão com os exercícios já errados, disponível a qualquer momento;
> - **Revisão**: sessão com os exercícios que já venceram o intervalo de repetição (revisão espaçada);
> - **Refazer os errados**: nova sessão apenas com os exercícios errados de uma sessão anterior.

## Não específicos

### RF08 - Feedback

> [✓] O sistema deve retornar um feedback sobre o desempenho do usuario na atividade.

### RF09 - Personalização com AI

> [✓] O sistema deve preparar atividades e feedbacks para o usuario personalizados por uma IA com base no histórico do usuario.

### RF10 - Dificuldade adaptativa

> [⚠️] O sistema deve ajustar a dificuldade das atividades conforme o desempenho do usuario em atividades anteriores.
> - A IA recebe a maestria, a confiança e as dificuldades do tópico ao gerar a sessão;
> - [✗] A dificuldade ainda não varia **dentro** da sessão (hoje é crescente por regra fixa).

### RF11 - Acompanhamento de progresso

> [⚠️] O sistema deve permitir que o usuario acompanhe o proprio progresso através de estatísticas, como:
> - Nível de constância (em porcentagem) — [✓] streak exibido na home e no perfil;
> - Mapa de calor — [✗] os dados por dia já são coletados (`daily_activity`), falta a visualização.

### RF12 - Integridade da recompensa

> [✓] O XP deve ser concedido exclusivamente pelo servidor, no momento da resposta, sem rota que permita ao cliente somar XP por conta própria.
