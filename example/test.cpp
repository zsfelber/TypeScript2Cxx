#include "test.h"

using namespace js;

Person::Person(string name) {
    this->name = name;
}

Employee::Employee(string name, string department) : Person(name) {
    this->department = department;
}

any Employee::get_ElevatorPitch()
{
    return STR("Hello, my name is ") + this->name + STR(" and I work in ") + this->department + STR(".");
}

Employee::Employee(string name) : Person(name) {
}

std::shared_ptr<Employee> howard = std::make_shared<Employee>(STR("Howard"), STR("Sales"));

void Main(void)
{
    console->log(howard->get_ElevatorPitch());
}

MAIN
