#ifndef TEST_H
#define TEST_H
#include "core.h"

using namespace js;

class Person;
class Employee;

class Person : public object, public std::enable_shared_from_this<Person> {
public:
    using std::enable_shared_from_this<Person>::shared_from_this;
    string name;

    Person(string name);
};

class Employee : public Person, public std::enable_shared_from_this<Employee> {
public:
    using std::enable_shared_from_this<Employee>::shared_from_this;
    string department;

    Employee(string name, string department);
    virtual any get_ElevatorPitch();
    Employee(string name);
};

extern std::shared_ptr<Employee> howard;
#endif
