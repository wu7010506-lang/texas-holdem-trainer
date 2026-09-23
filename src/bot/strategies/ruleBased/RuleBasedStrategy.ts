import { BotStrategy } from '../BotStrategy';
import { BotDecision, BotDecisionContext, BotProfile } from '../../types';
import { ProfileDrivenStrategy } from '../../ProfileDrivenStrategy';
import { DEFAULT_PROFILES } from '../../defaultProfiles';

export class RuleBasedStrategy implements BotStrategy {
  public name = 'RuleBasedStrategy';
  public version = '1.0.0';
  private innerStrategy: ProfileDrivenStrategy;
  private defaultProfile: BotProfile;

  constructor(profile?: BotProfile) {
    this.innerStrategy = new ProfileDrivenStrategy();
    this.defaultProfile = profile || DEFAULT_PROFILES['tag'];
  }

  public setProfile(profile: BotProfile): void {
    this.defaultProfile = profile;
  }

  public decideAction(context: BotDecisionContext): BotDecision {
    return this.innerStrategy.decideAction(context, this.defaultProfile);
  }
}
