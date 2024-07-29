import * as b from "benny"

// Common types and interfaces
type FieldType = "uint8" | "uint16" | "uint32" | "float32"

type StructData<T> = {
  [K in keyof T]: number
}

// Version 1: Using new Function()
class BinaryStructBuilderV1<T extends Record<string, number>> {
  private size: number = 0
  private fields: Array<{
    offset: number
    size: number
    getter: string
    setter: string
  }> = []
  private fieldMap: Map<string, number> = new Map()
  private littleEndian: boolean

  constructor(littleEndian: boolean = true) {
    this.littleEndian = littleEndian
  }

  private allocField(type: FieldType): {
    offset: number
    size: number
    getter: string
    setter: string
  } {
    const offset = this.size
    let size: number
    let getter: string
    let setter: string

    switch (type) {
      case "uint8":
        size = 1
        getter = "getUint8"
        setter = "setUint8"
        break
      case "uint16":
        size = 2
        getter = "getUint16"
        setter = "setUint16"
        break
      case "uint32":
        size = 4
        getter = "getUint32"
        setter = "setUint32"
        break
      case "float32":
        size = 4
        getter = "getFloat32"
        setter = "setFloat32"
        break
    }

    this.size += size
    return { offset, size, getter, setter }
  }

  addField<K extends string>(
    name: K,
    type: FieldType
  ): BinaryStructBuilderV1<T & Record<K, number>> {
    const field = this.allocField(type)
    this.fields.push(field)
    this.fieldMap.set(name, this.fields.length - 1)
    return this as any
  }

  build() {
    const structSize = this.size
    const fields = this.fields
    const fieldMap = this.fieldMap
    const littleEndian = this.littleEndian

    const readFn = new Function(
      "buffer",
      `
      const view = buffer instanceof DataView ? buffer : new DataView(buffer);
      return {
        ${Array.from(fieldMap.entries())
          .map(([name, index]) => {
            const field = fields[index]
            return `${name}: view.${field.getter}(${field.offset}, ${littleEndian})`
          })
          .join(",\n")}
      };
    `
    ) as (buffer: ArrayBuffer | DataView) => StructData<T>

    const writeFn = new Function(
      "data",
      "buffer",
      `
      const view = buffer instanceof DataView ? buffer :
                   buffer instanceof ArrayBuffer ? new DataView(buffer) :
                   new DataView(new ArrayBuffer(${structSize}));
      ${Array.from(fieldMap.entries())
        .map(([name, index]) => {
          const field = fields[index]
          return `view.${field.setter}(${field.offset}, data.${name}, ${littleEndian});`
        })
        .join("\n")}
      return view.buffer;
    `
    ) as (data: StructData<T>, buffer?: ArrayBuffer | DataView) => ArrayBuffer

    return {
      size: structSize,
      read: readFn,
      write: writeFn,
    }
  }
}

// Version 2: Using regular functions
class BinaryStructBuilderV2<T extends Record<string, number>> {
  private size: number = 0
  private fields: Array<{
    name: string
    offset: number
    size: number
    read: (view: DataView) => number
    write: (view: DataView, value: number) => void
  }> = []
  private littleEndian: boolean

  constructor(littleEndian: boolean = true) {
    this.littleEndian = littleEndian
  }

  private allocField(name: string, type: FieldType): void {
    const offset = this.size
    let size: number
    let read: (view: DataView) => number
    let write: (view: DataView, value: number) => void

    switch (type) {
      case "uint8":
        size = 1
        read = (view) => view.getUint8(offset)
        write = (view, value) => view.setUint8(offset, value)
        break
      case "uint16":
        size = 2
        read = (view) => view.getUint16(offset, this.littleEndian)
        write = (view, value) =>
          view.setUint16(offset, value, this.littleEndian)
        break
      case "uint32":
        size = 4
        read = (view) => view.getUint32(offset, this.littleEndian)
        write = (view, value) =>
          view.setUint32(offset, value, this.littleEndian)
        break
      case "float32":
        size = 4
        read = (view) => view.getFloat32(offset, this.littleEndian)
        write = (view, value) =>
          view.setFloat32(offset, value, this.littleEndian)
        break
    }

    this.size += size
    this.fields.push({ name, offset, size, read, write })
  }

  addField<K extends string>(
    name: K,
    type: FieldType
  ): BinaryStructBuilderV2<T & Record<K, number>> {
    this.allocField(name, type)
    return this as any
  }

  build() {
    const structSize = this.size
    const fields = this.fields

    return {
      size: structSize,
      read: (buffer: ArrayBuffer | DataView): StructData<T> => {
        const view = buffer instanceof DataView ? buffer : new DataView(buffer)
        const result: Partial<StructData<T>> = {}
        for (const field of fields) {
          result[field.name as keyof T] = field.read(view)
        }
        return result as StructData<T>
      },
      write: (
        data: StructData<T>,
        buffer?: ArrayBuffer | DataView
      ): ArrayBuffer => {
        const view =
          buffer instanceof DataView
            ? buffer
            : buffer instanceof ArrayBuffer
            ? new DataView(buffer)
            : new DataView(new ArrayBuffer(structSize))
        for (const field of fields) {
          field.write(view, data[field.name as keyof T])
        }
        return view.buffer
      },
    }
  }
}

// Benchmark setup
const ComplexStruct = {
  id: "uint32",
  x: "float32",
  y: "float32",
  z: "float32",
  flags: "uint16",
  type: "uint8",
  reserved: "uint8",
} as const

const structV1 = Object.entries(ComplexStruct)
  .reduce(
    (b, [name, type]) => b.addField(name, type as FieldType),
    new BinaryStructBuilderV1()
  )
  .build()

const structV2 = Object.entries(ComplexStruct)
  .reduce(
    (b, [name, type]) => b.addField(name, type as FieldType),
    new BinaryStructBuilderV2()
  )
  .build()

const data = {
  id: 1234,
  x: 1.5,
  y: 2.5,
  z: 3.5,
  flags: 0b1010101010101010,
  type: 255,
  reserved: 0,
}

b.suite(
  "Binary Struct Builder Benchmark",

  b.add("new Function() ", () => {
    const bufferV1 = structV1.write(data)
    structV1.read(bufferV1)
  }),

  b.add("Regular functions", () => {
    const bufferV2 = structV2.write(data)
    structV2.read(bufferV2)
  }),

  b.add("JSON", () => {
    const stringData = JSON.stringify(data)
    JSON.parse(stringData)
  }),

  b.cycle(),
  b.complete(),
  b.save({ file: "binary-struct-benchmark", version: "1.0.0" }),
  b.save({ file: "binary-struct-benchmark", format: "chart.html" })
)
