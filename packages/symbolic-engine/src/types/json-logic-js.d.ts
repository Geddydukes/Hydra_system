declare module 'json-logic-js' {
  interface JsonLogic {
    apply(logic: any, data?: any): any;
    is_logic(logic: any): boolean;
    truthy(value: any): boolean;
    get_operator(logic: any): string;
    get_values(logic: any): any[];
    uses_data(logic: any): boolean;
    add_operation(name: string, callback: Function): void;
    rm_operation(name: string): void;
    rule_like(logic: any): boolean;
  }
  
  const jsonLogic: JsonLogic;
  export = jsonLogic;
}
