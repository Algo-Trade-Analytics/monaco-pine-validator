import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';

describe('Method Parameter Naming Flexibility', () => {
  const validator = new EnhancedModularValidator();

  it('should accept method with parameter named "this"', () => {
    const code = `//@version=6
indicator("Method This Test")

type Point
    float x
    float y

method move(Point this, float dx, float dy) =>
    this.x := this.x + dx
    this.y := this.y + dy

p = Point.new(0, 0)
p.move(10, 20)
plot(p.x)`;

    const result = validator.validate(code);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept method with parameter named "arr"', () => {
    const code = `//@version=6
indicator("Method Arr Test")

type Arrays
    array<float> values

method push(Arrays arr, float value) =>
    arr.values.push(value)

a = Arrays.new(array.new<float>())
a.push(42.0)
plot(a.values.get(0))`;

    const result = validator.validate(code);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept method with parameter named "obj"', () => {
    const code = `//@version=6
indicator("Method Obj Test")

type Counter
    int count

method increment(Counter obj) =>
    obj.count := obj.count + 1

c = Counter.new(0)
c.increment()
plot(c.count)`;

    const result = validator.validate(code);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept method with parameter named "self"', () => {
    const code = `//@version=6
indicator("Method Self Test")

type State
    bool active

method toggle(State self) =>
    self.active := not self.active

s = State.new(false)
s.toggle()
plot(s.active ? 1 : 0)`;

    const result = validator.validate(code);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept method with parameter named "data"', () => {
    const code = `//@version=6
indicator("Method Data Test")

type DataPoint
    float value
    int timestamp

method update(DataPoint data, float newValue) =>
    data.value := newValue
    data.timestamp := time

d = DataPoint.new(0.0, 0)
d.update(close)
plot(d.value)`;

    const result = validator.validate(code);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should error on method without type annotation', () => {
    const code = `//@version=6
indicator("Method No Type Test")

type Point
    float x
    float y

method move(p, float dx) =>
    p.x := p.x + dx

plot(close)`;

    const result = validator.validate(code);
    expect(result.errors.some(e => e.code === 'PSV6-METHOD-THIS')).toBe(true);
  });

  it('should error on method without first parameter', () => {
    const code = `//@version=6
indicator("Method No Param Test")

type Point
    float x
    float y

method getX() =>
    0.0

plot(close)`;

    const result = validator.validate(code);
    expect(result.errors.some(e => e.code === 'PSV6-METHOD-THIS')).toBe(true);
  });

  it('should accept method with complex UDT type', () => {
    const code = `//@version=6
indicator("Method Complex UDT Test")

type Node
    float value
    int id

type Graph
    array<Node> nodes

method addNode(Graph graph, Node node) =>
    graph.nodes.push(node)

g = Graph.new(array.new<Node>())
n = Node.new(42.0, 1)
g.addNode(n)
plot(g.nodes.size())`;

    const result = validator.validate(code);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept multiple methods with different parameter names', () => {
    const code = `//@version=6
indicator("Multiple Methods Test")

type Calculator
    float result

method add(Calculator calc, float value) =>
    calc.result := calc.result + value

method subtract(Calculator obj, float value) =>
    obj.result := obj.result - value

method multiply(Calculator this, float value) =>
    this.result := this.result * value

c = Calculator.new(10.0)
c.add(5.0)
c.subtract(3.0)
c.multiply(2.0)
plot(c.result)`;

    const result = validator.validate(code);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept method with built-in type parameter name', () => {
    const code = `//@version=6
indicator("Method Builtin Name Test")

type Container
    float value

method setValue(Container container, float newValue) =>
    container.value := newValue

c = Container.new(0.0)
c.setValue(close)
plot(c.value)`;

    const result = validator.validate(code);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
