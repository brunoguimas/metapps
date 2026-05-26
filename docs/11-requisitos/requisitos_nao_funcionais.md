# Requisitos não-funcionais

## Interface do usuário

### RNF01 - Cores

> O sistema deve utilizar majoritariamente tons de azul, âmbar e branco no seu design.

### RNF02 - Design

> O sistema deve apresentar um design amigável:
> - Bordas arredondadas;
> - Feedback visual (botões mudam de cor);
> - Linguagem clara;
> - Barras de progresso.

## Experiência do usuário

### RNF03 - Operações rápidas
> O sistema deve responder requisições simples em até 500 ms em condições normais de uso.

### RNF04 - Operações complexas

> O sistema deve retornar respostas geradas por inteligência artificial em até 5 segundos, podendo chegar a 10 segundos em situações excepcionais.

## Segurança

### RNF05 - Armazenamento seguro de senhas

> O sistema deve armazenar senhas utilizando algoritmos de hash seguros, não sendo permitido o armazenamento em texto plano.

### RNF06 - Autenticação JWT (Json Web Token)

> O sistema deve utilizar autenticação baseada em tokens JWT (JSON Web Tokens) para controle de acesso.

### RNF07 - Autenticação externa

> O sistema pode permitir autenticação por meio de provedores externos utilizando OAuth (ex: Google).

## Tecnologias

### RNF08 - Backend

> O sistema deve utilizar Go (Golang) em seu backend, junto das seguintes bibliotecas:
> - Biblioteca padrão Go;
> - "SQLC";
> - "Golang-migrate";
> - "Gin".

### RNF9 - Frontend

> O sistema deve utilizar React como principal tecnologia para desenvolvimento do frontend.

### RNF10 - Banco de dados

> O sistema deve utilizar PostgresSQL como sistema gerenciador de banco de dados.

### RNF11 - Plataforma de banco

> O sistema deve utilizar Supabase como plataforma de desenvolvimento do banco de dados Postgres.

### RNF12 - Versionamento

> O sistema deve ser versionado utilizando Git, com repositório hospedado no GitHub.

### RNF13 - Docker

> O backend deve ser containerizado por meio do docker, facilitando implantação.

### RNF14 - PWA

> O sistema deve ser desenvolvido como uma aplicação web progressiva (PWA), permitindo sua instalação em dispositivos móveis.

## Não específicos

### RNF15 - Disponibilidade

> O sistema deve estar disponível para acesso em dispositivos móveis e desktops por meio de navegadores web.

### RNF17 - Escalabilidade

> O sistema deve suportar múltiplos usuários simultâneos sem degradação significativa de desempenho.

### RNF18 - Manutenibilidade

> O sistema deve ser desenvolvido de forma modular, facilitando manutenção e evolução.
