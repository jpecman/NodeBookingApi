import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator';

/**
 * Rejects a date earlier than the date in `property` on the same object. Equal is allowed.
 * Passes when either side isn't a valid Date, leaving that error to @IsDate.
 */
export function IsNotBefore(property: string, options?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isNotBefore',
      target: target.constructor,
      propertyName: propertyName as string,
      constraints: [property],
      options: {
        message: ({ property: self, constraints }: ValidationArguments) =>
          `${self} must not be before ${constraints[0]}`,
        ...options,
      },
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const other = (args.object as Record<string, unknown>)[args.constraints[0] as string];
          if (!isValidDate(value) || !isValidDate(other)) {
            return true;
          }
          return value.getTime() >= other.getTime();
        },
      },
    });
  };
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}
