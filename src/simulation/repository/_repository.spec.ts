import {
  SimulationRepository,
  SimulationComponent,
} from "./_repository"

import {
  expect,
  describe,
  test,
} from "vitest"

import { EntityRegistry, EntId } from "../EntityRegistry"

class TestComponent extends SimulationComponent {
}

class TestRepository extends SimulationRepository<TestComponent> {
  public static readonly Id = 'Test'
  public GetId = () => TestRepository.Id

  public static Factory() {
    return new TestRepository(TestComponent)
  }
}

describe('SimulationDb', () => {
  test('CreateComponent', () => {
    const simulation = new EntityRegistry()
    const repository = TestRepository.Factory()

    const entId = simulation.Create()
    repository.CreateComponent(entId)

    expect([...repository.Components].includes(entId)).toBeTruthy()
  })

  test('RemoveComponent', () => {
    const simulation = new EntityRegistry()
    const repository = TestRepository.Factory()

    const entId = simulation.Create()
    repository.CreateComponent(entId)
    repository.RemoveComponent(entId)

    expect([...repository.Components].includes(entId)).toBeFalsy()
  })
})
