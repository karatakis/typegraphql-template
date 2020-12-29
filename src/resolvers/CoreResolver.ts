import { Query, Resolver } from 'type-graphql'
import packageConfig from '../../package.json'

@Resolver()
export class CoreResolver {
  @Query()
  version (): string {
    return packageConfig.version
  }
}
