import {
  SimulationRepository,
  SimulationComponent,
} from "./_repository"

class SensorTargetComponent extends SimulationComponent {
}

export class SensorTargetRepository extends SimulationRepository<SensorTargetComponent> {
  public static Factory() {
    return new SensorTargetRepository(SensorTargetComponent)
  }
}
