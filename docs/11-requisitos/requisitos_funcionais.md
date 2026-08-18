# Requisitos funcionais

## Cadastro e login

### RF01 - Cadastro

> [✓] O sistema deve permitir que os usuário se cadastrem utilizando nome de usuário, email e senha.

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

### RF08 - Feedback

> [✓] O sistema deve retornar um feedback sobre o desempenho do usuario na atividade.

### RF09 - Personalização com AI

> [✓] O sistema deve preparar atividades e feedbacks para o usuario personalizados por uma IA com base no histórico do usuario.

### RF10 - Dificuldade adaptativa

> [?] O sistema deve ajustar a dificuldade das atividades conforme o desempenho do usuario em atividades anteriores.

## Não específicos

### RF11 - Acompanhamento de progresso

> [⚠️] O sistema deve permitir que o usuario acompanhe o proprio progresso através de estatísticas, como:
> - Nível de constânia (em porcentagem);
> - Mapa de calor.
