# Typescript graphql template
A project template I use in various projects of mine.
The API is in graphql with mikro-orm integrated.
It includes a basic authentication API with email support.

## Features
* linting
* testing
* graphql
* orm
* transactions
* authentication
* JWT
* typescript
* queues
* mail

## Getting started
1. `yarn install`
2. `cp .env.example .env`
3. modify `.env` file
4. `yarn mikro-orm migration:up`
5. `yarn start`

## Testing
1. `yarn install`
2. `cp .env.example .env.test`
3. modify `.env.test` file
5. `yarn test`

## TODO
* Captcha at UserResolver
* Add serviceAddress to MailJob
* Use html template engines for mails
* configure nodemailer